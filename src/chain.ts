import {
  decodeAddressArray,
  decodeGetSummary,
  decodeReadAllFeedback,
  encodeGetClients,
  encodeGetSummary,
  encodeReadAllFeedback,
  type ChainFeedback,
  type ChainSummary,
} from "./abi.ts";

/** Canonical ERC-8004 registries on Arc, from https://docs.arc.io/arc/references/contract-addresses */
export const ARC = {
  mainnet: { chainId: 5042, rpc: "https://rpc.mainnet.arc.io", reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" },
  testnet: { chainId: 5042002, rpc: "https://rpc.testnet.arc.io", reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" },
} as const;

export interface ChainTarget {
  rpc: string;
  reputationRegistry: string;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Read-only eth_call. Never signs, never sends a transaction. */
export async function ethCall(target: ChainTarget, data: string, fetchFn: Fetch = fetch as unknown as Fetch): Promise<string> {
  const res = await fetchFn(target.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: target.reputationRegistry, data }, "latest"] }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const body = (await res.json()) as { result?: string; error?: { message?: string } };
  if (body.error) throw new Error(`RPC error: ${body.error.message ?? "unknown"}`);
  if (typeof body.result !== "string") throw new Error("RPC returned no result");
  return body.result;
}

export async function getClients(target: ChainTarget, agentId: number | bigint, fetchFn?: Fetch): Promise<string[]> {
  return decodeAddressArray(await ethCall(target, encodeGetClients(agentId), fetchFn));
}

/** All feedback for an agent, revoked entries included and marked. */
export async function readAllFeedback(target: ChainTarget, agentId: number | bigint, fetchFn?: Fetch): Promise<ChainFeedback[]> {
  return decodeReadAllFeedback(await ethCall(target, encodeReadAllFeedback(agentId), fetchFn));
}

/** The registry's own untagged summary: a plain mean of every non-revoked entry from the given clients. */
export async function getSummary(target: ChainTarget, agentId: number | bigint, clients: string[], fetchFn?: Fetch): Promise<ChainSummary | null> {
  if (clients.length === 0) return null;
  return decodeGetSummary(await ethCall(target, encodeGetSummary(agentId, clients), fetchFn));
}
