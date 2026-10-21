import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, summarize } from "../src/normalize.ts";
import { ruleFor } from "../src/tags.ts";

test("documented binary tag is a flag, not a rating", () => {
  const n = normalize({ value: 1, tag1: "ownerVerified" });
  assert.equal(n.kind, "binary");
  assert.equal(n.passed, true);
  assert.equal(n.countsAsRating, false);
  assert.equal(n.basis, "documented");
});

test("inferred binary tag is flagged as inferred", () => {
  const n = normalize({ value: 1, tag1: "metadataVerified" });
  assert.equal(n.kind, "binary");
  assert.equal(n.basis, "inferred");
});

test("binary tag with a non-binary value is not silently accepted", () => {
  const n = normalize({ value: 7, tag1: "reachable" });
  assert.equal(n.kind, "binary");
  assert.equal(n.passed, undefined);
  assert.equal(n.countsAsRating, false);
});

test("valueDecimals is applied; a 0-100 percentage counts on the rating scale", () => {
  const n = normalize({ value: 9977, valueDecimals: 2, tag1: "uptime" });
  assert.equal(n.kind, "percent");
  assert.equal(n.value, 99.77);
  assert.equal(n.rating, 99.77);
  assert.equal(n.countsAsRating, true);
});

test("measurements in other units never count as ratings", () => {
  assert.equal(normalize({ value: 560, tag1: "responseTime" }).countsAsRating, false);
  assert.equal(normalize({ value: 40, tag1: "responseTime" }).countsAsRating, false);
  assert.equal(normalize({ value: 4, tag1: "blocktimeFreshness" }).countsAsRating, false);
  assert.equal(normalize({ value: 1100, tag1: "revenues" }).countsAsRating, false);
});

test("invalid decimals are rejected", () => {
  assert.equal(normalize({ value: 1, valueDecimals: 19, tag1: "starred" }).kind, "unknown");
  assert.equal(normalize({ value: "abc", tag1: "starred" }).kind, "unknown");
});

test("documented rating counts; out-of-range rating does not", () => {
  assert.equal(normalize({ value: 85, tag1: "starred" }).rating, 85);
  assert.equal(normalize({ value: 120, tag1: "starred" }).countsAsRating, false);
});

test("unknown tag: compatible policy assumes a rating, strict policy refuses", () => {
  const c = normalize({ value: 90, tag1: "bounty_completed" }, "compatible");
  assert.equal(c.countsAsRating, true);
  assert.equal(c.basis, "assumed");
  const s = normalize({ value: 90, tag1: "bounty_completed" }, "strict");
  assert.equal(s.countsAsRating, false);
});

test("unknown tag with a fractional value below 1 is not treated as a rating", () => {
  const n = normalize({ value: 0.02, tag1: "bench:toll" });
  assert.equal(n.countsAsRating, false);
  assert.equal(n.kind, "unknown");
});

test("tag lookup is exact and does not guess", () => {
  assert.equal(ruleFor("MetadataVerified"), undefined);
  assert.equal(ruleFor(""), undefined);
  assert.equal(ruleFor(null), undefined);
});

test("summary: a passed check no longer drags a 100 rating down", () => {
  const s = summarize([
    { value: 100, tag1: "starred" },
    { value: 1, tag1: "metadataVerified" },
  ]);
  assert.equal(s.average, 100);
  assert.equal(s.count, 1);
  assert.equal(s.binaryPassed, 1);
});

test("summary: only binary flags leaves no rating evidence", () => {
  const s = summarize([
    { value: 1, tag1: "metadataVerified" },
    { value: 1, tag1: "metadataVerified" },
  ]);
  assert.equal(s.average, null);
  assert.equal(s.binaryPassed, 2);
});
