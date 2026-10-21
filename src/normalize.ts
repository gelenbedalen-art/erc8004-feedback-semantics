import { ruleFor, type Confidence, type SignalKind } from "./tags.ts";

/** One feedback entry. `value` is the human-scale number unless `valueDecimals` is given. */
export interface FeedbackInput {
  value: number | string;
  /** Raw on-chain decimals. Omit when `value` is already scaled (as the ArcID API returns it). */
  valueDecimals?: number;
  tag1?: string | null;
  tag2?: string | null;
}

/**
 * - "strict": only tags with a known rating rule count toward a rating average.
 * - "compatible": unknown tags also count when their value looks like a 0-100
 *   score (an integer-ish value in [0, 100]); they are flagged as assumptions.
 */
export type Policy = "strict" | "compatible";

export interface Normalized {
  kind: SignalKind;
  /** Scaled numeric value. */
  value: number;
  /** Present only when the entry may feed a 0-100 rating average. */
  rating?: number;
  /** Present only for binary signals. */
  passed?: boolean;
  countsAsRating: boolean;
  basis: Confidence | "assumed" | "none";
  reason: string;
}

function scaled(input: FeedbackInput): number {
  const v = typeof input.value === "string" ? Number(input.value) : input.value;
  if (!Number.isFinite(v)) return Number.NaN;
  const d = input.valueDecimals ?? 0;
  if (!Number.isInteger(d) || d < 0 || d > 18) return Number.NaN;
  return v / 10 ** d;
}

export function normalize(input: FeedbackInput, policy: Policy = "compatible"): Normalized {
  const value = scaled(input);
  if (Number.isNaN(value)) {
    return { kind: "unknown", value, countsAsRating: false, basis: "none", reason: "value or valueDecimals is not a valid number" };
  }

  const rule = ruleFor(input.tag1);
  if (rule) {
    switch (rule.kind) {
      case "rating":
        if (value < 0 || value > 100) {
          return { kind: "rating", value, countsAsRating: false, basis: rule.confidence, reason: `rating outside 0-100 (${value})` };
        }
        return { kind: "rating", value, rating: value, countsAsRating: true, basis: rule.confidence, reason: rule.note };
      case "binary":
        if (value !== 0 && value !== 1) {
          return { kind: "binary", value, countsAsRating: false, basis: rule.confidence, reason: `binary tag with non-binary value (${value})` };
        }
        return { kind: "binary", value, passed: value === 1, countsAsRating: false, basis: rule.confidence, reason: rule.note };
      case "percent":
        // A 0-100 percentage (uptime, success rate) is on the same scale as a rating; counting it is a
        // reasonable reading and keeps this library from overriding scorer choices it has no evidence against.
        if (value < 0 || value > 100) {
          return { kind: "percent", value, countsAsRating: false, basis: rule.confidence, reason: `percentage outside 0-100 (${value})` };
        }
        return { kind: "percent", value, rating: value, countsAsRating: true, basis: rule.confidence, reason: `${rule.note}; counted on the 0-100 scale` };
      default:
        return { kind: rule.kind, value, countsAsRating: false, basis: rule.confidence, reason: `${rule.note}; a measurement in other units, not a rating` };
    }
  }

  if (policy === "strict") {
    return { kind: "unknown", value, countsAsRating: false, basis: "none", reason: "unknown tag; strict policy counts only known rating tags" };
  }
  if (value < 0 || value > 100) {
    return { kind: "unknown", value, countsAsRating: false, basis: "none", reason: `unknown tag with value outside 0-100 (${value})` };
  }
  if (value > 0 && value < 1) {
    return { kind: "unknown", value, countsAsRating: false, basis: "none", reason: `unknown tag with fractional value below 1 (${value}); looks like a unit amount, not a 0-100 score` };
  }
  return { kind: "rating", value, rating: value, countsAsRating: true, basis: "assumed", reason: "unknown tag; value in 0-100 treated as a rating (assumption)" };
}

export interface RatingSummary {
  count: number;
  average: number | null;
  excluded: number;
  binaryPassed: number;
  binaryFailed: number;
}

/** Plain mean of entries that count as ratings, plus counts of what was kept out. */
export function summarize(inputs: FeedbackInput[], policy: Policy = "compatible"): RatingSummary {
  let sum = 0;
  let count = 0;
  let excluded = 0;
  let binaryPassed = 0;
  let binaryFailed = 0;
  for (const input of inputs) {
    const n = normalize(input, policy);
    if (n.kind === "binary" && n.passed !== undefined) {
      if (n.passed) binaryPassed++;
      else binaryFailed++;
    }
    if (n.countsAsRating && n.rating !== undefined) {
      sum += n.rating;
      count++;
    } else {
      excluded++;
    }
  }
  return { count, average: count ? sum / count : null, excluded, binaryPassed, binaryFailed };
}
