/**
 * Read-only census of ERC-8004 feedback: what the ArcID indexer reports, cross-checked entry by entry
 * against the canonical Reputation Registry. Runs unchanged in Node (scripts/census.ts) and in a browser.
 *
 * Indexer endpoints (https://www.arcusid.com/docs): GET /v1/stats, /v1/agents, /v1/agents/:id/feedback.
 * Chain: eth_call readAllFeedback(agentId, [], "", "", true) on the registry. No wallet, no signing, no transactions.
 */
import { readAllFeedback, type ChainTarget } from "./chain.ts";
import type { ApiAgent, ApiFeedback, ChainOnlyFeedback, Snapshot } from "./snapshot.ts";

export interface CensusOptions {
  api: string;
  /** Registry to cross-check against; null skips the chain read. */
  chain: (ChainTarget & { chainId: number }) | null;
  delayMs?: number;
  log?: (msg: string) => void;
  /** Stop after this many agents (for quick runs); default: all agents with feedback. */
  limitAgents?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runCensus(o: CensusOptions): Promise<Snapshot> {
  const api = o.api.replace(/\/$/, "");
  const delay = o.delayMs ?? 350;
  const log = o.log ?? (() => {});

  async function get<T>(path: string): Promise<{ data: T; meta?: { total?: number } }> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`${api}${path}`, { headers: { accept: "application/json" } });
      if (res.status === 429) {
        await sleep(4000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
      const body = (await res.json()) as { success: boolean; data: T; error: unknown; meta?: { total?: number } };
      if (!body.success) throw new Error(`GET ${path} -> error ${JSON.stringify(body.error)}`);
      return body;
    }
    throw new Error(`GET ${path} -> rate limited after retries`);
  }

  const stats = (await get<unknown>("/v1/stats")).data;

  // Agents sorted by feedback count; stop at the first agent with none.
  const agents: ApiAgent[] = [];
  for (let page = 1, done = false; !done && page < 100; page++) {
    const { data } = await get<ApiAgent[]>(`/v1/agents?sort=feedback&limit=100&page=${page}`);
    if (data.length === 0) break;
    for (const a of data) {
      if ((a.reputation?.feedbackCount ?? 0) === 0 || (o.limitAgents !== undefined && agents.length >= o.limitAgents)) {
        done = true;
        break;
      }
      agents.push(a);
    }
    await sleep(delay);
  }

  const feedback: Record<string, ApiFeedback[]> = {};
  const chainOnly: Record<string, ChainOnlyFeedback[]> = {};
  for (const [i, a] of agents.entries()) {
    let items: ApiFeedback[] = [];
    for (let page = 1; ; page++) {
      const body = await get<ApiFeedback[]>(`/v1/agents/${a.id}/feedback?limit=50&page=${page}`);
      items = items.concat(body.data);
      if (body.data.length === 0 || items.length >= (body.meta?.total ?? 0)) break;
      await sleep(delay);
    }
    items = items.map((f) => ({
      client: f.client, index: f.index, value: f.value, tag1: f.tag1, tag2: f.tag2,
      block: f.block, revoked: f.revoked, kind: f.kind, rating: f.rating,
    }));

    if (o.chain) {
      const onChain = await readAllFeedback(o.chain, a.id);
      const key = (client: string, index: number) => `${client.toLowerCase()}#${index}`;
      const byKey = new Map(onChain.map((c) => [key(c.client, c.index), c]));
      for (const f of items) {
        const c = byKey.get(key(f.client, f.index));
        f.chainValue = c ? c.value : null;
        f.chainDecimals = c ? c.valueDecimals : null;
        f.chainMatch = c ? c.tag1 === (f.tag1 ?? "") && c.tag2 === (f.tag2 ?? "") && c.revoked === f.revoked : null;
        byKey.delete(key(f.client, f.index));
      }
      if (byKey.size) chainOnly[String(a.id)] = [...byKey.values()];
    }

    feedback[String(a.id)] = items;
    if ((i + 1) % 50 === 0) log(`agents: ${i + 1}/${agents.length}`);
    await sleep(delay);
  }

  return {
    source: api,
    fetchedAt: new Date().toISOString(),
    stats,
    chain: o.chain ? { chainId: o.chain.chainId, rpc: o.chain.rpc, reputationRegistry: o.chain.reputationRegistry } : null,
    agents,
    feedback,
    chainOnly,
  };
}
