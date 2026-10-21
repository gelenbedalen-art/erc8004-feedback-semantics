/**
 * Minimal ABI encoding for the few read-only ERC-8004 calls this library makes.
 * Selectors are keccak256 of the signatures in the reference implementation
 * (github.com/erc-8004/erc-8004-contracts, ReputationRegistryUpgradeable.sol).
 */
export const SELECTORS = {
  /** readAllFeedback(uint256,address[],string,string,bool) */
  readAllFeedback: "d9d84224",
  /** getClients(uint256) */
  getClients: "42dd519c",
  /** getSummary(uint256,address[],string,string) */
  getSummary: "81bbba58",
} as const;

const word = (n: bigint): string => {
  if (n < 0n) n = (1n << 256n) + n;
  return n.toString(16).padStart(64, "0");
};

const addressWord = (a: string): string => {
  const hex = a.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error(`invalid address: ${a}`);
  return hex.padStart(64, "0");
};

function stringTail(s: string): string {
  const bytes = new TextEncoder().encode(s);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
  return word(BigInt(bytes.length)) + padded;
}

const addressArrayTail = (xs: string[]): string => word(BigInt(xs.length)) + xs.map(addressWord).join("");

export function encodeGetClients(agentId: bigint | number): string {
  return "0x" + SELECTORS.getClients + word(BigInt(agentId));
}

/** readAllFeedback(agentId, clients, tag1, tag2, includeRevoked). Empty clients means "all clients". */
export function encodeReadAllFeedback(agentId: bigint | number, clients: string[] = [], tag1 = "", tag2 = "", includeRevoked = true): string {
  const a = addressArrayTail(clients);
  const t1 = stringTail(tag1);
  const t2 = stringTail(tag2);
  const head = 5 * 32;
  const o1 = head;
  const o2 = o1 + a.length / 2;
  const o3 = o2 + t1.length / 2;
  return "0x" + SELECTORS.readAllFeedback + word(BigInt(agentId)) + word(BigInt(o1)) + word(BigInt(o2)) + word(BigInt(o3)) + word(includeRevoked ? 1n : 0n) + a + t1 + t2;
}

/** getSummary(agentId, clients, tag1, tag2). The reference implementation reverts on an empty client list. */
export function encodeGetSummary(agentId: bigint | number, clients: string[], tag1 = "", tag2 = ""): string {
  const a = addressArrayTail(clients);
  const t1 = stringTail(tag1);
  const head = 4 * 32;
  const o1 = head;
  const o2 = o1 + a.length / 2;
  const o3 = o2 + t1.length / 2;
  return "0x" + SELECTORS.getSummary + word(BigInt(agentId)) + word(BigInt(o1)) + word(BigInt(o2)) + word(BigInt(o3)) + a + t1 + stringTail(tag2);
}

class Reader {
  private readonly hex: string;
  constructor(data: string) {
    this.hex = data.replace(/^0x/, "");
    if (this.hex.length % 64 !== 0) throw new Error("ABI data is not a whole number of words");
  }
  wordAt(byteOffset: number): bigint {
    const s = this.hex.slice(byteOffset * 2, byteOffset * 2 + 64);
    if (s.length !== 64) throw new Error(`ABI read out of range at ${byteOffset}`);
    return BigInt("0x" + s);
  }
  uint(byteOffset: number): number {
    const v = this.wordAt(byteOffset);
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("ABI length/offset too large");
    return Number(v);
  }
  int(byteOffset: number): bigint {
    const v = this.wordAt(byteOffset);
    return v >= 1n << 255n ? v - (1n << 256n) : v;
  }
  address(byteOffset: number): string {
    return "0x" + this.hex.slice(byteOffset * 2 + 24, byteOffset * 2 + 64);
  }
  string(byteOffset: number): string {
    const len = this.uint(byteOffset);
    const start = (byteOffset + 32) * 2;
    const s = this.hex.slice(start, start + len * 2);
    if (s.length !== len * 2) throw new Error("ABI string out of range");
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes);
  }
  /** Dynamic array at `byteOffset`; `item` reads element i given the array body start. */
  array<T>(byteOffset: number, item: (body: number, i: number) => T): T[] {
    const len = this.uint(byteOffset);
    const body = byteOffset + 32;
    return Array.from({ length: len }, (_, i) => item(body, i));
  }
}

export function decodeAddressArray(data: string): string[] {
  const r = new Reader(data);
  return r.array(r.uint(0), (body, i) => r.address(body + 32 * i));
}

export interface ChainFeedback {
  client: string;
  index: number;
  /** Raw int128 value as a decimal string (no precision loss). */
  value: string;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  revoked: boolean;
}

export function decodeReadAllFeedback(data: string): ChainFeedback[] {
  const r = new Reader(data);
  const off = (k: number) => r.uint(32 * k);
  const clients = r.array(off(0), (b, i) => r.address(b + 32 * i));
  const indexes = r.array(off(1), (b, i) => r.uint(b + 32 * i));
  const values = r.array(off(2), (b, i) => r.int(b + 32 * i));
  const decimals = r.array(off(3), (b, i) => r.uint(b + 32 * i));
  const strings = (k: number) => r.array(off(k), (b, i) => r.string(b + r.uint(b + 32 * i)));
  const tag1s = strings(4);
  const tag2s = strings(5);
  const revoked = r.array(off(6), (b, i) => r.wordAt(b + 32 * i) !== 0n);
  const n = clients.length;
  if ([indexes, values, decimals, tag1s, tag2s, revoked].some((xs) => xs.length !== n)) {
    throw new Error("readAllFeedback arrays have different lengths");
  }
  return clients.map((client, i) => ({
    client,
    index: indexes[i],
    value: values[i].toString(),
    valueDecimals: decimals[i],
    tag1: tag1s[i],
    tag2: tag2s[i],
    revoked: revoked[i],
  }));
}

export interface ChainSummary {
  count: number;
  summaryValue: string;
  summaryValueDecimals: number;
}

export function decodeGetSummary(data: string): ChainSummary {
  const r = new Reader(data);
  return { count: r.uint(0), summaryValue: r.int(32).toString(), summaryValueDecimals: r.uint(64) };
}
