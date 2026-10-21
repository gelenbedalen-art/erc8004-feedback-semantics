/**
 * Read-only census: ArcID indexer feedback, cross-checked against the canonical Reputation Registry on Arc.
 * No wallet, no signing, no transactions. Requests are sequential and throttled.
 *
 * Usage: node --experimental-strip-types scripts/census.ts [out.ndjson]
 * Env:   ARCID_API_URL (default https://api.arcusid.com)
 *        ARC_RPC_URL   (default https://rpc.mainnet.arc.io; set to "none" to skip the chain cross-check)
 *        CENSUS_DELAY_MS (default 350)
 */
import { writeFile } from "node:fs/promises";
import { ARC } from "../src/chain.ts";
import { runCensus } from "../src/census.ts";
import { toNdjson } from "../src/ndjson.ts";

const out = process.argv[2] ?? `data/snapshot-${new Date().toISOString().slice(0, 10)}.ndjson`;
const rpc = process.env.ARC_RPC_URL ?? ARC.mainnet.rpc;

const snapshot = await runCensus({
  api: process.env.ARCID_API_URL ?? "https://api.arcusid.com",
  chain: rpc === "none" ? null : { ...ARC.mainnet, rpc },
  delayMs: Number(process.env.CENSUS_DELAY_MS ?? 350),
  log: (m) => console.error(m),
});
await writeFile(out, toNdjson(snapshot));
const n = Object.values(snapshot.feedback).reduce((s, f) => s + f.length, 0);
console.error(`wrote ${out}: ${snapshot.agents.length} agents, ${n} feedback entries`);
