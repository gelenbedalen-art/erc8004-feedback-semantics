# ERC-8004 feedback semantics on Arc: census report

Snapshot: `snapshot-2026-10-21.ndjson`, fetched 2026-10-21T11:21:45.514Z from https://api.arcusid.com and cross-checked against the canonical Reputation Registry `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` on Arc mainnet (read-only, public endpoints).

## Finding 1: pass/fail flags are averaged as 0-100 ratings

107 agents have only binary "check passed" flags as feedback (for example `metadataVerified = 1`). ArcID labels every one of these entries as a 0-100 rating of 1, and 107 of the 107 agents have a Trust Score below the published starting prior of 50 (range 30.40 to 46.20).

Across the network, 108 of 338 agents with feedback (32%) have at least one binary flag read as a rating, 124 entries in all. Of the 124 agents scored below 50, 107 (86%) carry such a flag.

## Finding 2: values read on the wrong scale

For 4 entries ArcID's `rating` is not the on-chain value scaled by its `valueDecimals`. All of them were checked against the registry (`readAllFeedback`): in each case ArcID's rating is ten times the on-chain value. The table shows the raw on-chain value, its decimals, the value they stand for, the API's value and ArcID's rating.

| agent | tag1 / tag2 | on-chain value | decimals | stands for | API value | ArcID rating |
|---|---|---|---|---|---|---|
| 240 | uptime / week | 748 | 2 | 7.48 | 7.48 | 74.80 |
| 2419 | bench:toll / cost-usdc | 20000 | 6 | 0.02 | 0.02 | 0.20 |
| 2461 | bench:codebreaker / cost-usdc | 80000 | 6 | 0.08 | 0.08 | 0.80 |
| 2461 | bench:toll / cost-usdc | 70000 | 6 | 0.07 | 0.07 | 0.70 |

## How this was checked

- ArcID's own label per entry (`kind` in `/v1/agents/:id/feedback`): rating 593, revoked 6, receipt 2, metric 1.
- Consistency check: averaging ArcID's "rating" entries per client, then across clients, reproduces the API's `reputation.average` for every agent except: none. So every difference below comes from how entries are read, not from a different averaging method.
- On-chain cross-check: 602 of 602 indexer entries were found in the registry by (agent, client, index); 0 were not found; 0 differ in tags or revoked status; 0 registry entries were not returned by the indexer. Our reading uses the on-chain value and decimals.
- A tag is treated as binary only if it is documented as binary in the 8004scan Feedback Data Profile (`ownerVerified`, `reachable`, `correctness`), or if its name describes a pass/fail check and every observed value is 0 or 1 (`metadataVerified`, `stbAgentActive`). The second group is an inference and is marked as such below.
- The Trust Score formula is not public. This report does not predict corrected scores; it reports which inputs are misread and in which direction they push the score.

## Tags

| tag1 | entries | agents | ArcID kind | our kind | basis | min | max |
|---|---|---|---|---|---|---|---|
| `score` | 171 | 170 | rating 171 | rating | inferred | 25 | 95 |
| `uptime` | 145 | 65 | rating 145 | percent | documented | 0 | 100 |
| `metadataVerified` | 122 | 106 | rating 122 | binary | inferred | 1 | 1 |
| `agentkarma_metadata` | 46 | 46 | rating 46 | unknown | none | 72 | 100 |
| `readiness` | 15 | 1 | rating 15 | unknown | none | 18 | 68 |
| `fuci` | 12 | 6 | rating 12 | unknown | none | 20 | 100 |
| `completed` | 10 | 1 | rating 10 | unknown | none | 82 | 100 |
| `starred` | 9 | 4 | rating 8, revoked 1 | rating | documented | 1 | 100 |
| `x402_receipts_onchain` | 7 | 4 | rating 4, revoked 3 | unknown | none | 95 | 95 |
| `bounty_completed` | 6 | 1 | rating 6 | unknown | none | 80 | 95 |
| `honorar_answer` | 6 | 1 | rating 6 | unknown | none | 50 | 100 |
| `answer_refused` | 5 | 1 | rating 5 | unknown | none | 0 | 0 |
| `answer_settled` | 4 | 1 | rating 4 | unknown | none | 100 | 100 |
| `erc8183` | 4 | 2 | rating 4 | unknown | none | 0.10 | 100 |
| `runVerdict` | 4 | 1 | rating 4 | unknown | none | 83.96 | 92.23 |
| `warrant-preflight` | 4 | 2 | rating 4 | unknown | none | 1 | 1 |
| `Speed` | 3 | 2 | rating 3 | unknown | none | 71 | 90 |
| `successRate` | 3 | 3 | rating 3 | percent | documented | 100 | 100 |
| `warrant-oracle` | 3 | 2 | rating 2, metric 1 | unknown | none | -1 | 1 |
| `bench:toll` | 2 | 2 | rating 2 | unknown | none | 0.02 | 0.07 |
| `bountyagent` | 2 | 1 | receipt 2 | unknown | none | 0.01 | 0.01 |
| `corpusQuality` | 2 | 1 | rating 2 | unknown | none | 100 | 100 |
| `credential_signing_verified` | 2 | 1 | rating 1, revoked 1 | unknown | none | 95 | 95 |
| `payouts_onchain_verified` | 2 | 1 | rating 1, revoked 1 | unknown | none | 95 | 95 |
| `stbSellerScore` | 2 | 1 | rating 2 | unknown | none | 41 | 43 |
| `a-identity:reputation:v1:onchain-identity-basis` | 1 | 1 | rating 1 | unknown | none | 6 | 6 |
| `bench:codebreaker` | 1 | 1 | rating 1 | unknown | none | 0.08 | 0.08 |
| `c0der-canario` | 1 | 1 | rating 1 | unknown | none | 100 | 100 |
| `complir-screen` | 1 | 1 | rating 1 | unknown | none | 87 | 87 |
| `halflife` | 1 | 1 | rating 1 | unknown | none | 100 | 100 |
| `job-2` | 1 | 1 | rating 1 | unknown | none | 90 | 90 |
| `ownerVerified` | 1 | 1 | rating 1 | binary | documented | 1 | 1 |
| `quality` | 1 | 1 | rating 1 | unknown | none | 100 | 100 |
| `stbAgentActive` | 1 | 1 | rating 1 | binary | inferred | 1 | 1 |
| `task` | 1 | 1 | rating 1 | unknown | none | 100 | 100 |
| `x402-paid-call` | 1 | 1 | rating 1 | unknown | none | 100 | 100 |

`min` and `max` are the API's values.

## Agents with binary flags read as ratings

`ArcID mean` averages the entries ArcID labels as ratings per client, then across clients (this matches the API's `reputation.average`). `Our mean` does the same after dropping binary flags and unit-like values (0-100 percentages still count); `-` means no rating evidence remains.

| agent | name | Trust Score | ArcID mean | flags read as rating | basis | our mean | paid clients |
|---|---|---|---|---|---|---|---|
| 1407 |  | 30.40 | 1 | 8/8 | inferred | - | 0 |
| 1408 |  | 33.70 | 1 | 6/6 | inferred | - | 0 |
| 1409 |  | 35.60 | 1 | 5/5 | inferred | - | 0 |
| 1410 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 1411 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2334 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2335 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2337 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2339 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2340 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2341 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2344 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2345 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2346 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2347 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2348 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2349 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2350 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2445 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2446 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2447 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2448 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2450 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2451 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2452 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2453 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2454 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2455 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2456 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2457 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2462 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2463 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2464 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2465 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2466 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2485 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2486 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2487 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2488 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2489 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2490 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2491 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2492 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2493 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2494 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2495 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2496 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2497 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2498 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2499 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2501 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2502 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2503 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2504 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2505 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2506 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2507 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2508 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2514 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2515 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2516 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2519 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2526 | STB agent 0x6527a9A9 | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2547 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2548 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2549 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2550 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2551 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2553 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2554 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2555 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2556 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2557 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2558 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2559 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2560 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2561 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2562 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2563 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2564 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2565 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2566 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2567 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2568 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2569 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2592 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2593 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2594 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2595 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2596 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2597 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2598 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2599 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2600 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2601 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2602 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2603 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2604 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2605 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2606 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2607 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2608 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2609 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2610 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2612 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2613 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 2614 |  | 46.20 | 1 | 1/1 | inferred | - | 0 |
| 289 |  | 52.20 | 68.14 | 1/5 | documented | 92.89 | 1 |

## Unit-like values read as ratings

4 entries on 3 agents have an unknown tag and a fractional value below 1 (for example a fee or price), and are labelled as ratings. They are listed in the tag table; the library leaves them out of rating averages.

## Limits

- Binary meaning for `metadataVerified` and `stbAgentActive` is inferred from the tag name and observed values, not from a published definition by the writer of those entries.
- The agent list, Trust Scores and ArcID's labels come from the ArcID indexer; only feedback values, decimals, tags and revoked status are checked on-chain.
- This is a point-in-time snapshot. Scores and feedback change as new entries arrive.
