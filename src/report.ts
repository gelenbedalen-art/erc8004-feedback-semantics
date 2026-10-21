import { PUBLISHED_PRIOR, type Findings } from "./analyze.ts";

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : "n/a");
const num = (v: number | null) => (v === null ? "-" : Number.isInteger(v) ? String(v) : v.toFixed(2));
const kinds = (k: Record<string, number>) =>
  Object.entries(k)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([n, c]) => `${n} ${c}`)
    .join(", ");
const cell = (s: string | null) => (s ?? "").replace(/[|`\n\r]/g, " ").slice(0, 40);

/** Markdown report. A pure function of the findings: the same snapshot always gives the same text. */
export function render(f: Findings, snapshotName: string): string {
  const L: string[] = [];
  const onChain = f.chain.entriesChecked > 0;
  L.push("# ERC-8004 feedback semantics on Arc: census report", "");
  L.push(
    `Snapshot: \`${snapshotName}\`, fetched ${f.fetchedAt} from ${f.source}` +
      (onChain ? ` and cross-checked against the canonical Reputation Registry \`${f.chain.registry}\` on Arc mainnet` : "") +
      " (read-only, public endpoints).",
    "",
  );

  L.push("## Finding 1: pass/fail flags are averaged as 0-100 ratings", "");
  L.push(
    `${f.onlyBinaryAgents} agents have only binary "check passed" flags as feedback (for example \`metadataVerified = 1\`). ` +
      `ArcID labels every one of these entries as a 0-100 rating of 1, and ${f.onlyBinaryBelowPrior} of the ${f.onlyBinaryAgents} agents ` +
      `have a Trust Score below the published starting prior of ${PUBLISHED_PRIOR}` +
      (f.onlyBinaryScoreRange ? ` (range ${num(f.onlyBinaryScoreRange[0])} to ${num(f.onlyBinaryScoreRange[1])}).` : "."),
    "",
  );
  L.push(
    `Across the network, ${f.affectedAgents} of ${f.agentsWithFeedback} agents with feedback (${pct(f.affectedAgents, f.agentsWithFeedback)}) ` +
      `have at least one binary flag read as a rating, ${f.affectedEntries} entries in all. Of the ${f.agentsBelowPrior} agents scored below ${PUBLISHED_PRIOR}, ` +
      `${f.agentsBelowPriorWithBinary} (${pct(f.agentsBelowPriorWithBinary, f.agentsBelowPrior)}) carry such a flag.`,
    "",
  );

  if (f.scaleDisagreements.length) {
    const verified = f.scaleDisagreements.filter((d) => d.chainScaled !== null);
    // The API's value matches the chain in every checked entry; only ArcID's rating differs.
    L.push(`## Finding 2: ${verified.length ? "values read on the wrong scale" : "entries where the API's rating and value disagree"}`, "");
    L.push(
      verified.length
        ? `For ${f.scaleDisagreements.length} entries ArcID's \`rating\` is not the on-chain value scaled by its \`valueDecimals\`. ` +
            `${verified.length === f.scaleDisagreements.length ? "All of them were" : `${verified.length} of them were`} checked against the registry (\`readAllFeedback\`)` +
            (verified.every((d) => Math.abs(d.apiRating - 10 * (d.chainScaled as number)) < 1e-9) ? ": in each case ArcID's rating is ten times the on-chain value. " : ". ") +
            "The table shows the raw on-chain value, its decimals, the value they stand for, the API's value and ArcID's rating."
        : `For ${f.scaleDisagreements.length} entries the API's \`rating\` is not equal to its \`value\`. Without the on-chain \`valueDecimals\` this report cannot tell which is right; it keeps ArcID's rating.`,
      "",
      "| agent | tag1 / tag2 | on-chain value | decimals | stands for | API value | ArcID rating |",
      "|---|---|---|---|---|---|---|",
    );
    for (const d of f.scaleDisagreements) {
      L.push(
        `| ${d.agent} | ${cell(d.tag1)} / ${cell(d.tag2)} | ${d.chainValue ?? "not read"} | ${d.chainDecimals ?? "-"} | ${num(d.chainScaled)} | ${num(d.apiValue)} | ${num(d.apiRating)} |`,
      );
    }
    L.push("");
  }

  L.push("## How this was checked", "");
  L.push(
    `- ArcID's own label per entry (\`kind\` in \`/v1/agents/:id/feedback\`): ${kinds(f.arcidKinds)}.`,
    `- Consistency check: averaging ArcID's "rating" entries per client, then across clients, reproduces the API's \`reputation.average\` for every agent except: ${
      f.averageMismatches.length ? f.averageMismatches.join(", ") : "none"
    }. So every difference below comes from how entries are read, not from a different averaging method.`,
  );
  if (onChain || f.chain.entriesNotFound) {
    L.push(
      `- On-chain cross-check: ${f.chain.entriesChecked} of ${f.feedbackEntries} indexer entries were found in the registry by (agent, client, index); ` +
        `${f.chain.entriesNotFound} were not found; ${f.chain.tagOrRevokedMismatches} differ in tags or revoked status; ` +
        `${f.chain.chainOnlyEntries} registry entries were not returned by the indexer. Our reading uses the on-chain value and decimals.`,
    );
  }
  L.push(
    "- A tag is treated as binary only if it is documented as binary in the 8004scan Feedback Data Profile (`ownerVerified`, `reachable`, `correctness`), " +
      "or if its name describes a pass/fail check and every observed value is 0 or 1 (`metadataVerified`, `stbAgentActive`). The second group is an inference and is marked as such below.",
    "- The Trust Score formula is not public. This report does not predict corrected scores; it reports which inputs are misread and in which direction they push the score.",
    "",
  );

  L.push("## Tags", "");
  L.push("| tag1 | entries | agents | ArcID kind | our kind | basis | min | max |", "|---|---|---|---|---|---|---|---|");
  for (const t of f.tags) {
    L.push(`| \`${t.tag}\` | ${t.entries} | ${t.agents} | ${kinds(t.arcidKinds)} | ${t.ourKind} | ${t.basis} | ${num(t.min)} | ${num(t.max)} |`);
  }
  L.push("", "`min` and `max` are the API's values.", "");

  L.push("## Agents with binary flags read as ratings", "");
  L.push(
    "`ArcID mean` averages the entries ArcID labels as ratings per client, then across clients (this matches the API's `reputation.average`). " +
      "`Our mean` does the same after dropping binary flags and unit-like values (0-100 percentages still count); `-` means no rating evidence remains.",
    "",
    "| agent | name | Trust Score | ArcID mean | flags read as rating | basis | our mean | paid clients |",
    "|---|---|---|---|---|---|---|---|",
  );
  const affected = f.agents.filter((a) => a.binaryReadAsRating > 0).sort((a, b) => a.trustScore - b.trustScore || a.id - b.id);
  for (const a of affected) {
    L.push(
      `| ${a.id} | ${cell(a.name)} | ${num(a.trustScore)} | ${num(a.arcidRatingMean)} | ${a.binaryReadAsRating}/${a.arcidRatingCount} | ${a.binaryReadAsRatingBasis.join(", ")} | ${num(
        a.ourAverage,
      )} | ${a.paidClients} |`,
    );
  }
  L.push("");

  if (f.unitLikeEntries) {
    L.push("## Unit-like values read as ratings", "");
    L.push(
      `${f.unitLikeEntries} entries on ${f.unitLikeAgents} agents have an unknown tag and a fractional value below 1 (for example a fee or price), and are labelled as ratings. ` +
        "They are listed in the tag table; the library leaves them out of rating averages.",
      "",
    );
  }

  L.push("## Limits", "");
  L.push(
    "- Binary meaning for `metadataVerified` and `stbAgentActive` is inferred from the tag name and observed values, not from a published definition by the writer of those entries.",
    "- The agent list, Trust Scores and ArcID's labels come from the ArcID indexer; only feedback values, decimals, tags and revoked status are checked on-chain.",
    "- This is a point-in-time snapshot. Scores and feedback change as new entries arrive.",
    "",
  );
  return L.join("\n");
}
