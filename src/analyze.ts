import { normalize, summarize, type FeedbackInput } from "./normalize.ts";
import { ruleFor } from "./tags.ts";
import type { ApiFeedback, Snapshot } from "./snapshot.ts";

/** Prior the ArcID Security page says scores start from (https://www.arcusid.com/security). */
export const PUBLISHED_PRIOR = 50;

export interface TagRow {
  tag: string;
  entries: number;
  agents: number;
  arcidKinds: Record<string, number>;
  ourKind: string;
  basis: string;
  min: number;
  max: number;
}

export interface AgentRow {
  id: number;
  name: string | null;
  trustScore: number;
  apiAverage: number | null;
  /** Mean of per-client means of entries ArcID labels "rating", recomputed from the feedback list. */
  arcidRatingMean: number | null;
  arcidRatingCount: number;
  /** Entries ArcID labels "rating" that our dictionary classifies as binary flags. */
  binaryReadAsRating: number;
  binaryReadAsRatingBasis: string[];
  /** Entries ArcID labels "rating" with a fractional value below 1 under an unknown tag. */
  unitLikeReadAsRating: number;
  ourAverage: number | null;
  ourRatingCount: number;
  paidClients: number;
}

export interface Findings {
  fetchedAt: string;
  source: string;
  agentsWithFeedback: number;
  feedbackEntries: number;
  arcidKinds: Record<string, number>;
  tags: TagRow[];
  agents: AgentRow[];
  /** Agents with at least one binary flag read as a rating. */
  affectedAgents: number;
  affectedEntries: number;
  /** Agents whose every ArcID "rating" entry is a binary flag. */
  onlyBinaryAgents: number;
  onlyBinaryBelowPrior: number;
  onlyBinaryScoreRange: [number, number] | null;
  agentsBelowPrior: number;
  agentsBelowPriorWithBinary: number;
  unitLikeAgents: number;
  unitLikeEntries: number;
  /** Consistency check: agents where our recomputed ArcID mean differs from the API's average by > 0.01. */
  averageMismatches: number[];
  /** Entries where ArcID's `rating` differs from the value it should stand for (see `scaleDisagrees`). */
  scaleDisagreements: ScaleDisagreement[];
  /** Cross-check against the canonical Reputation Registry (all zero when the snapshot has no chain data). */
  chain: {
    registry: string | null;
    entriesChecked: number;
    entriesNotFound: number;
    tagOrRevokedMismatches: number;
    chainOnlyEntries: number;
  };
}

export interface ScaleDisagreement {
  agent: number;
  tag1: string | null;
  tag2: string | null;
  apiValue: number;
  apiRating: number;
  /** On-chain raw value and decimals, when the entry was read from the registry. */
  chainValue: string | null;
  chainDecimals: number | null;
  /** On-chain value scaled by its decimals. */
  chainScaled: number | null;
}

const hasChain = (f: ApiFeedback): boolean => f.chainValue !== null && f.chainValue !== undefined && f.chainDecimals !== null && f.chainDecimals !== undefined;

/** On-chain value scaled by its decimals, or null when the entry was not read from the registry. */
export const chainScaled = (f: ApiFeedback): number | null => (hasChain(f) ? Number(f.chainValue) / 10 ** Number(f.chainDecimals) : null);

/**
 * True when ArcID's `rating` for an entry it labels a rating differs from the value it stands for.
 * With chain data the reference is the registry's value / 10^valueDecimals (verified); without it,
 * the reference is the API's own `value` (the API omits valueDecimals, so which is right is undecided).
 */
export const scaleDisagrees = (f: ApiFeedback): boolean => {
  if (f.kind !== "rating" || f.rating === null || f.rating === undefined) return false;
  const ref = chainScaled(f) ?? Number(f.value);
  return Math.abs(Number(f.rating) - ref) > 1e-9;
};

/**
 * Input for our reading. With chain data, the registry's raw value and decimals are used as-is.
 * Without it, ArcID's rating is kept where it disagrees with the API value (no evidence to override it).
 */
const toInput = (f: ApiFeedback): FeedbackInput =>
  hasChain(f)
    ? { value: String(f.chainValue), valueDecimals: Number(f.chainDecimals), tag1: f.tag1, tag2: f.tag2 }
    : { value: scaleDisagrees(f) ? Number(f.rating) : f.value, tag1: f.tag1, tag2: f.tag2 };

function byClient(items: ApiFeedback[]): ApiFeedback[][] {
  const groups = new Map<string, ApiFeedback[]>();
  for (const f of items) groups.set(f.client.toLowerCase(), [...(groups.get(f.client.toLowerCase()) ?? []), f]);
  return [...groups.values()];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * ArcID's `reputation.average` is a mean of per-client means (each client's entries are averaged first),
 * which this reproduces from the feedback list. Our reading applies the same grouping after normalization.
 */
function clientMeans(items: ApiFeedback[]): { arcid: number | null; ours: number | null } {
  const groups = byClient(items);
  const arcid = mean(groups.map((g) => mean(g.map((f) => Number(f.rating ?? f.value))) as number));
  const ours = mean(
    groups.map((g) => summarize(g.map(toInput)).average).filter((v): v is number => v !== null),
  );
  return { arcid, ours };
}

export function analyze(s: Snapshot): Findings {
  const all = Object.entries(s.feedback).flatMap(([id, items]) => items.map((f) => ({ agent: Number(id), f })));

  const arcidKinds: Record<string, number> = {};
  for (const { f } of all) arcidKinds[f.kind] = (arcidKinds[f.kind] ?? 0) + 1;

  const tagMap = new Map<string, { entries: number; agents: Set<number>; kinds: Record<string, number>; min: number; max: number }>();
  for (const { agent, f } of all) {
    const key = f.tag1 || "(empty)";
    const t = tagMap.get(key) ?? { entries: 0, agents: new Set<number>(), kinds: {}, min: Infinity, max: -Infinity };
    const v = Number(f.value);
    t.entries++;
    t.agents.add(agent);
    t.kinds[f.kind] = (t.kinds[f.kind] ?? 0) + 1;
    t.min = Math.min(t.min, v);
    t.max = Math.max(t.max, v);
    tagMap.set(key, t);
  }
  const tags: TagRow[] = [...tagMap.entries()]
    .map(([tag, t]) => {
      const rule = ruleFor(tag === "(empty)" ? null : tag);
      return {
        tag,
        entries: t.entries,
        agents: t.agents.size,
        arcidKinds: t.kinds,
        ourKind: rule?.kind ?? "unknown",
        basis: rule?.confidence ?? "none",
        min: t.min,
        max: t.max,
      };
    })
    .sort((a, b) => b.entries - a.entries || a.tag.localeCompare(b.tag));

  const agents: AgentRow[] = s.agents.map((a) => {
    const items = s.feedback[String(a.id)] ?? [];
    const arcRatings = items.filter((f) => f.kind === "rating");
    const means = clientMeans(arcRatings);
    let binary = 0;
    let unitLike = 0;
    const basis = new Set<string>();
    for (const f of arcRatings) {
      const n = normalize(toInput(f));
      if (n.kind === "binary") {
        binary++;
        basis.add(n.basis);
      } else if (n.kind === "unknown" && n.value > 0 && n.value < 1) {
        unitLike++;
      }
    }
    // Our reading of the same entries ArcID rates (receipts, revoked, self are left as ArcID classified them).
    const ours = summarize(arcRatings.map(toInput));
    return {
      id: a.id,
      name: a.name,
      trustScore: a.trustScore,
      apiAverage: a.reputation?.average ?? null,
      arcidRatingMean: means.arcid,
      arcidRatingCount: arcRatings.length,
      binaryReadAsRating: binary,
      binaryReadAsRatingBasis: [...basis].sort(),
      unitLikeReadAsRating: unitLike,
      ourAverage: means.ours,
      ourRatingCount: ours.count,
      paidClients: a.trust?.paidClients ?? 0,
    };
  });

  const affected = agents.filter((a) => a.binaryReadAsRating > 0);
  const onlyBinary = agents.filter((a) => a.arcidRatingCount > 0 && a.binaryReadAsRating === a.arcidRatingCount);
  const onlyBinaryScores = onlyBinary.map((a) => a.trustScore);
  const below = agents.filter((a) => a.trustScore < PUBLISHED_PRIOR);
  const unitLike = agents.filter((a) => a.unitLikeReadAsRating > 0);
  const scaleDisagreements: ScaleDisagreement[] = all
    .filter(({ f }) => scaleDisagrees(f))
    .map(({ agent, f }) => ({
      agent,
      tag1: f.tag1,
      tag2: f.tag2,
      apiValue: Number(f.value),
      apiRating: Number(f.rating),
      chainValue: hasChain(f) ? String(f.chainValue) : null,
      chainDecimals: hasChain(f) ? Number(f.chainDecimals) : null,
      chainScaled: chainScaled(f),
    }));
  const checked = all.filter(({ f }) => hasChain(f));

  return {
    fetchedAt: s.fetchedAt,
    source: s.source,
    agentsWithFeedback: s.agents.length,
    feedbackEntries: all.length,
    arcidKinds,
    tags,
    agents,
    affectedAgents: affected.length,
    affectedEntries: affected.reduce((sum, a) => sum + a.binaryReadAsRating, 0),
    onlyBinaryAgents: onlyBinary.length,
    onlyBinaryBelowPrior: onlyBinary.filter((a) => a.trustScore < PUBLISHED_PRIOR).length,
    onlyBinaryScoreRange: onlyBinaryScores.length ? [Math.min(...onlyBinaryScores), Math.max(...onlyBinaryScores)] : null,
    agentsBelowPrior: below.length,
    agentsBelowPriorWithBinary: below.filter((a) => a.binaryReadAsRating > 0).length,
    unitLikeAgents: unitLike.length,
    unitLikeEntries: unitLike.reduce((sum, a) => sum + a.unitLikeReadAsRating, 0),
    averageMismatches: agents
      .filter((a) => a.apiAverage !== null && a.arcidRatingMean !== null && Math.abs(a.apiAverage - a.arcidRatingMean) > 0.01)
      .map((a) => a.id),
    scaleDisagreements,
    chain: {
      registry: s.chain?.reputationRegistry ?? null,
      entriesChecked: checked.length,
      entriesNotFound: s.chain ? all.length - checked.length : 0,
      tagOrRevokedMismatches: checked.filter(({ f }) => f.chainMatch === false).length,
      chainOnlyEntries: Object.values(s.chainOnly ?? {}).reduce((n, xs) => n + xs.length, 0),
    },
  };
}
