/**
 * Tag dictionary for ERC-8004 Reputation Registry feedback.
 *
 * ERC-8004 stores `value` / `valueDecimals` and two free-form tags, and leaves
 * the meaning of a value to off-chain convention. This dictionary records what
 * a value means for each known `tag1`, and where that knowledge comes from:
 *
 * - "documented": listed in the 8004scan Feedback Data Profile
 *   (https://best-practices.8004scan.io/docs/02-feedback-standard.html).
 * - "inferred": not documented anywhere we found; inferred from the tag name
 *   and from every value observed on Arc. Inferred rules are flagged in all
 *   output so they can be reviewed, never presented as a standard.
 *
 * Tags not listed here are "unknown". The library does not guess their meaning.
 */

export type SignalKind =
  | "rating" // quality score on a 0-100 scale
  | "binary" // 0 = false, 1 = true (a check passed or failed)
  | "percent" // a measured percentage, 0-100 (uptime, success rate)
  | "duration_ms" // latency in milliseconds
  | "count" // a plain count (blocks, requests)
  | "currency_usd" // an amount of money
  | "unknown";

export type Confidence = "documented" | "inferred";

export interface TagRule {
  tag: string;
  kind: SignalKind;
  confidence: Confidence;
  note: string;
}

const DOC = "8004scan Feedback Data Profile";

export const TAG_RULES: readonly TagRule[] = [
  { tag: "starred", kind: "rating", confidence: "documented", note: `${DOC}: quality rating, 0-100 scale` },
  { tag: "reachable", kind: "binary", confidence: "documented", note: `${DOC}: is endpoint reachable, 0 or 1` },
  { tag: "ownerVerified", kind: "binary", confidence: "documented", note: `${DOC}: endpoint ownership proof, 0 or 1` },
  { tag: "correctness", kind: "binary", confidence: "documented", note: `${DOC}: response correctness, 0 or 1` },
  { tag: "uptime", kind: "percent", confidence: "documented", note: `${DOC}: endpoint uptime %` },
  { tag: "successRate", kind: "percent", confidence: "documented", note: `${DOC}: request success rate %` },
  { tag: "responseTime", kind: "duration_ms", confidence: "documented", note: `${DOC}: response time in ms` },
  { tag: "blocktimeFreshness", kind: "count", confidence: "documented", note: `${DOC}: block delay in blocks` },
  { tag: "revenues", kind: "currency_usd", confidence: "documented", note: `${DOC}: cumulative revenues in $` },

  {
    tag: "metadataVerified",
    kind: "binary",
    confidence: "inferred",
    note: "Name describes a pass/fail check, analogous to ownerVerified; every value observed on Arc is 1",
  },
  {
    tag: "stbAgentActive",
    kind: "binary",
    confidence: "inferred",
    note: "Name describes an active/inactive flag; every value observed on Arc is 1",
  },
  {
    tag: "score",
    kind: "rating",
    confidence: "inferred",
    note: "Name describes a score; observed values on Arc lie between 25 and 95",
  },
];

const BY_TAG = new Map(TAG_RULES.map((r) => [r.tag, r]));

/** Exact, case-sensitive lookup. Unknown tags return undefined; nothing is guessed. */
export function ruleFor(tag1: string | null | undefined): TagRule | undefined {
  if (!tag1) return undefined;
  return BY_TAG.get(tag1);
}
