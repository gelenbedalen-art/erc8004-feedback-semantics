import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeAddressArray, decodeGetSummary, decodeReadAllFeedback, encodeGetClients, encodeGetSummary, encodeReadAllFeedback } from "../src/abi.ts";
import { readAllFeedback } from "../src/chain.ts";

const w = (n: bigint | number) => {
  let v = BigInt(n);
  if (v < 0n) v = (1n << 256n) + v;
  return v.toString(16).padStart(64, "0");
};
const str = (s: string) => {
  const hex = Buffer.from(s, "utf8").toString("hex");
  return w(s.length) + hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
};

test("readAllFeedback call encodes an empty client list and empty tags", () => {
  const data = encodeReadAllFeedback(240);
  assert.equal(data.slice(0, 10), "0xd9d84224");
  const words = data.slice(10).match(/.{64}/g)!;
  assert.deepEqual(words.map((x) => BigInt("0x" + x)), [240n, 0xa0n, 0xc0n, 0xe0n, 1n, 0n, 0n, 0n]);
});

test("getClients and getSummary calls", () => {
  assert.equal(encodeGetClients(5), "0x42dd519c" + w(5));
  const data = encodeGetSummary(1, ["0x00000000000000000000000000000000000000aa"]);
  const words = data.slice(10).match(/.{64}/g)!;
  assert.equal(data.slice(0, 10), "0x81bbba58");
  assert.deepEqual(words.map((x) => BigInt("0x" + x)), [1n, 0x80n, 0xc0n, 0xe0n, 1n, 0xaan, 0n, 0n]);
});

// Hand-built return data for two entries, one negative and one with a multi-word tag.
const longTag = "a-tag-that-is-longer-than-thirty-two-bytes";
function sampleReturn(): string {
  const addr = (x: string) => x.padStart(64, "0");
  const arr = (items: string[]) => w(items.length) + items.join("");
  const strArr = (items: string[]) => {
    const bodies = items.map(str);
    let off = 32 * items.length;
    const heads = bodies.map((b) => {
      const h = w(off);
      off += b.length / 2;
      return h;
    });
    return w(items.length) + heads.join("") + bodies.join("");
  };
  const parts = [
    arr([addr("6a66"), addr("bbbb")]),
    arr([w(1), w(2)]),
    arr([w(748), w(-5)]),
    arr([w(2), w(0)]),
    strArr(["uptime", longTag]),
    strArr(["week", ""]),
    arr([w(0), w(1)]),
  ];
  let off = 7 * 32;
  const heads = parts.map((p) => {
    const h = w(off);
    off += p.length / 2;
    return h;
  });
  return "0x" + heads.join("") + parts.join("");
}

test("readAllFeedback return data decodes, including negative values and long strings", () => {
  const rows = decodeReadAllFeedback(sampleReturn());
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { client: "0x" + "6a66".padStart(40, "0"), index: 1, value: "748", valueDecimals: 2, tag1: "uptime", tag2: "week", revoked: false });
  assert.equal(rows[1].value, "-5");
  assert.equal(rows[1].tag1, longTag);
  assert.equal(rows[1].tag2, "");
  assert.equal(rows[1].revoked, true);
});

test("address array and summary decode", () => {
  assert.deepEqual(decodeAddressArray("0x" + w(32) + w(1) + "aa".padStart(64, "0")), ["0x" + "aa".padStart(40, "0")]);
  assert.deepEqual(decodeGetSummary("0x" + w(2) + w(374) + w(2)), { count: 2, summaryValue: "374", summaryValueDecimals: 2 });
});

test("chain reader uses eth_call only and surfaces RPC errors", async () => {
  const calls: string[] = [];
  const ok = async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body).method);
    return { ok: true, status: 200, json: async () => ({ result: sampleReturn() }) };
  };
  const rows = await readAllFeedback({ rpc: "http://rpc", reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" }, 240, ok as never);
  assert.equal(rows.length, 2);
  assert.deepEqual(calls, ["eth_call"]);
  const bad = async () => ({ ok: true, status: 200, json: async () => ({ error: { message: "execution reverted" } }) });
  await assert.rejects(readAllFeedback({ rpc: "http://rpc", reputationRegistry: "0x0" }, 1, bad as never), /execution reverted/);
});
