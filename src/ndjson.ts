import type { ApiAgent, ApiFeedback, ChainOnlyFeedback, Snapshot } from "./snapshot.ts";

/**
 * Compact line format for committed snapshots:
 *   line 1: header object { source, fetchedAt, stats, chain, format }
 *   A[id,name,feedbackCount,clients,average,validationsTotal,validationsPassed,trustScore,trustVersion,settledUsdc,paidClients,unpaidClients]
 *   F[agentId,client,index,value,tag1,tag2,block,revoked,kind,rating,chainValue,chainDecimals,chainMatch]
 *   C[agentId,client,index,value,valueDecimals,tag1,tag2,revoked]   (on-chain entries the indexer did not return)
 * ndjson-v1 files (no chain fields, no C rows) are still read.
 * Non-ASCII characters are written as \uXXXX escapes so the file is plain ASCII.
 */
export const FORMAT =
  "ndjson-v2: A=[id,name,feedbackCount,clients,average,validationsTotal,validationsPassed,trustScore,trustVersion,settledUsdc,paidClients,unpaidClients]; " +
  "F=[agentId,client,index,value,tag1,tag2,block,revoked,kind,rating,chainValue,chainDecimals,chainMatch]; " +
  "C=[agentId,client,index,value,valueDecimals,tag1,tag2,revoked]";

const esc = (s: string) => s.replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const J = (v: unknown) => esc(JSON.stringify(v));

export function toNdjson(s: Snapshot): string {
  const lines = [J({ source: s.source, fetchedAt: s.fetchedAt, stats: s.stats, chain: s.chain ?? null, format: FORMAT })];
  for (const a of s.agents) {
    lines.push(
      "A" +
        J([
          a.id,
          a.name,
          a.reputation?.feedbackCount ?? null,
          a.reputation?.clients ?? null,
          a.reputation?.average ?? null,
          a.validations?.total ?? null,
          a.validations?.passed ?? null,
          a.trustScore,
          a.trust?.version ?? null,
          a.trust?.settledUsdc ?? null,
          a.trust?.paidClients ?? null,
          a.trust?.unpaidClients ?? null,
        ]),
    );
  }
  for (const a of s.agents) {
    for (const f of s.feedback[String(a.id)] ?? []) {
      lines.push(
        "F" +
          J([a.id, f.client, f.index, f.value, f.tag1, f.tag2, f.block, f.revoked, f.kind, f.rating, f.chainValue ?? null, f.chainDecimals ?? null, f.chainMatch ?? null]),
      );
    }
    for (const c of s.chainOnly?.[String(a.id)] ?? []) {
      lines.push("C" + J([a.id, c.client, c.index, c.value, c.valueDecimals, c.tag1, c.tag2, c.revoked]));
    }
  }
  return lines.join("\n") + "\n";
}

export function fromNdjson(text: string): Snapshot {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = JSON.parse(lines[0]) as { source: string; fetchedAt: string; stats: unknown; chain?: Snapshot["chain"]; format: string };
  if (!/^ndjson-v[12]\b/.test(header.format ?? "")) throw new Error(`unsupported snapshot format: ${header.format}`);
  const agents: ApiAgent[] = [];
  const feedback: Record<string, ApiFeedback[]> = {};
  const chainOnly: Record<string, ChainOnlyFeedback[]> = {};
  for (const line of lines.slice(1)) {
    const row = JSON.parse(line.slice(1)) as unknown[];
    if (line[0] === "A") {
      const [id, name, feedbackCount, clients, average, vTotal, vPassed, trustScore, version, settledUsdc, paidClients, unpaidClients] = row as [
        number, string | null, number, number, number | null, number, number, number, number, number, number, number,
      ];
      agents.push({
        id,
        name,
        reputation: { feedbackCount, clients, average },
        validations: { total: vTotal, passed: vPassed },
        trustScore,
        trust: { version, settledUsdc, paidClients, unpaidClients },
      });
      feedback[String(id)] ??= [];
    } else if (line[0] === "F") {
      const [agentId, client, index, value, tag1, tag2, block, revoked, kind, rating, chainValue = null, chainDecimals = null, chainMatch = null] = row as [
        number, string, number, number | string, string | null, string | null, number, boolean, string, number | null, string | null, number | null, boolean | null,
      ];
      (feedback[String(agentId)] ??= []).push({ client, index, value, tag1, tag2, block, revoked, kind, rating, chainValue, chainDecimals, chainMatch });
    } else if (line[0] === "C") {
      const [agentId, client, index, value, valueDecimals, tag1, tag2, revoked] = row as [number, string, number, string, number, string, string, boolean];
      (chainOnly[String(agentId)] ??= []).push({ client, index, value, valueDecimals, tag1, tag2, revoked });
    } else {
      throw new Error(`bad snapshot line: ${line.slice(0, 40)}`);
    }
  }
  return { source: header.source, fetchedAt: header.fetchedAt, stats: header.stats, chain: header.chain ?? null, agents, feedback, chainOnly };
}
