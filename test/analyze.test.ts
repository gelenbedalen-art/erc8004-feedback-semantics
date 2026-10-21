import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/analyze.ts";
import type { ApiAgent, ApiFeedback, Snapshot } from "../src/snapshot.ts";

const agent = (id: number, score: number, average: number | null, paid = 0): ApiAgent => ({
  id,
  name: `agent ${id}`,
  owner: `0xowner${id}`,
  agentWallet: null,
  reputation: { feedbackCount: 0, clients: 0, average },
  validations: { total: 0, passed: 0 },
  trustScore: score,
  trust: { version: 1, settledUsdc: 0, paidClients: paid, unpaidClients: 0 },
});

let n = 0;
const fb = (tag1: string, value: number, kind = "rating"): ApiFeedback => ({
  client: `0xclient${++n}`,
  index: 1,
  value,
  tag1,
  tag2: null,
  block: n,
  revoked: kind === "revoked",
  kind,
  rating: kind === "rating" ? value : null,
});

const snapshot: Snapshot = {
  source: "fixture",
  fetchedAt: "2026-10-21T00:00:00Z",
  stats: null,
  agents: [agent(1, 33.7, 1), agent(2, 75, 67), agent(3, 80, 90), agent(4, 45, 40)],
  feedback: {
    "1": [fb("metadataVerified", 1), fb("metadataVerified", 1)],
    "2": [fb("starred", 100), fb("starred", 100), fb("metadataVerified", 1)],
    "3": [fb("score", 90), fb("bench:toll", 0.02, "rating"), fb("x", 95, "revoked")],
    "4": [fb("score", 40)],
  },
};

test("counts binary flags read as ratings, per agent and overall", () => {
  const f = analyze(snapshot);
  assert.equal(f.agentsWithFeedback, 4);
  assert.equal(f.feedbackEntries, 9);
  assert.equal(f.affectedAgents, 2);
  assert.equal(f.affectedEntries, 3);
  assert.equal(f.onlyBinaryAgents, 1);
  assert.equal(f.onlyBinaryBelowPrior, 1);
  assert.deepEqual(f.onlyBinaryScoreRange, [33.7, 33.7]);
  assert.equal(f.agentsBelowPrior, 2);
  assert.equal(f.agentsBelowPriorWithBinary, 1);
  assert.equal(f.unitLikeAgents, 1);
  assert.equal(f.unitLikeEntries, 1);
});

test("our reading removes the flag and the unit-like value", () => {
  const f = analyze(snapshot);
  const a1 = f.agents.find((a) => a.id === 1)!;
  assert.equal(a1.ourAverage, null);
  assert.equal(a1.arcidRatingMean, 1);
  const a2 = f.agents.find((a) => a.id === 2)!;
  assert.equal(a2.ourAverage, 100);
  const a3 = f.agents.find((a) => a.id === 3)!;
  assert.equal(a3.ourAverage, 90);
});

test("flags agents whose API average does not match recomputed ArcID ratings", () => {
  const f = analyze(snapshot);
  // Agent 3: API says 90, ArcID 'rating' entries are 90 and 0.02 from two clients -> mean 45.01.
  assert.deepEqual(f.averageMismatches, [3]);
});

test("ArcID-style average is a mean of per-client means", () => {
  const s: Snapshot = {
    ...snapshot,
    agents: [agent(9, 67.5, 89.96)],
    feedback: {
      "9": [
        { ...fb("uptime", 100), client: "0xA" },
        { ...fb("score", 63), client: "0xA" },
        { ...fb("uptime", 100), client: "0xA" },
        { ...fb("uptime", 100), client: "0xA" },
        ...[80, 95, 90, 85, 95, 90].map((v) => ({ ...fb("bounty_completed", v), client: "0xB" })),
      ],
    },
  };
  const f = analyze(s);
  assert.equal(Number(f.agents[0].arcidRatingMean!.toFixed(2)), 89.96);
  assert.deepEqual(f.averageMismatches, []);
});

test("tag table reports ArcID kind next to ours", () => {
  const f = analyze(snapshot);
  const mv = f.tags.find((t) => t.tag === "metadataVerified")!;
  assert.equal(mv.entries, 3);
  assert.equal(mv.ourKind, "binary");
  assert.deepEqual(mv.arcidKinds, { rating: 3 });
});

test("ndjson round-trip preserves the analysis", async () => {
  const { toNdjson, fromNdjson } = await import("../src/ndjson.ts");
  const text = toNdjson(snapshot);
  assert.ok(/^[\x00-\x7f]*$/.test(text), "snapshot file is plain ASCII");
  const back = fromNdjson(text);
  assert.deepEqual(analyze(back), analyze(snapshot));
});

test("rating/value disagreements are reported and do not change our reading", () => {
  const s: Snapshot = {
    ...snapshot,
    agents: [agent(7, 49, 37.4)],
    feedback: { "7": [{ ...fb("uptime", 7.48), rating: 74.8, client: "0xC" }, { ...fb("uptime", 0), client: "0xC" }] },
  };
  const f = analyze(s);
  assert.equal(f.scaleDisagreements.length, 1);
  assert.equal(f.scaleDisagreements[0].apiRating, 74.8);
  assert.equal(f.scaleDisagreements[0].chainScaled, null);
  assert.equal(Number(f.agents[0].arcidRatingMean!.toFixed(2)), 37.4);
  assert.equal(Number(f.agents[0].ourAverage!.toFixed(2)), 37.4);
});

test("with chain data, the registry value decides the scale", () => {
  const s: Snapshot = {
    ...snapshot,
    chain: { chainId: 5042, rpc: "x", reputationRegistry: "0xreg" },
    agents: [agent(7, 49, 37.4)],
    feedback: {
      "7": [
        { ...fb("uptime", 7.48), rating: 74.8, client: "0xC", index: 2, chainValue: "748", chainDecimals: 2, chainMatch: true },
        { ...fb("uptime", 0), client: "0xC", index: 1, chainValue: "0", chainDecimals: 2, chainMatch: true },
      ],
    },
  };
  const f = analyze(s);
  assert.equal(f.scaleDisagreements.length, 1);
  assert.equal(f.scaleDisagreements[0].chainScaled, 7.48);
  assert.equal(Number(f.agents[0].arcidRatingMean!.toFixed(2)), 37.4);
  assert.equal(Number(f.agents[0].ourAverage!.toFixed(2)), 3.74);
  assert.equal(f.chain.entriesChecked, 2);
  assert.equal(f.chain.entriesNotFound, 0);
});

test("chain-only entries and tag mismatches are counted", async () => {
  const { toNdjson, fromNdjson } = await import("../src/ndjson.ts");
  const s: Snapshot = {
    ...snapshot,
    chain: { chainId: 5042, rpc: "x", reputationRegistry: "0xreg" },
    agents: [agent(8, 50, 90)],
    feedback: { "8": [{ ...fb("starred", 90), chainValue: "90", chainDecimals: 0, chainMatch: false }, { ...fb("starred", 80) }] },
    chainOnly: { "8": [{ client: "0xd", index: 3, value: "1", valueDecimals: 0, tag1: "reachable", tag2: "", revoked: false }] },
  };
  const back = fromNdjson(toNdjson(s));
  const f = analyze(back);
  assert.equal(f.chain.entriesChecked, 1);
  assert.equal(f.chain.entriesNotFound, 1);
  assert.equal(f.chain.tagOrRevokedMismatches, 1);
  assert.equal(f.chain.chainOnlyEntries, 1);
});
