# erc8004-feedback-semantics

ERC-8004 feedback is a number plus two free-form tags. The standard leaves the meaning of the number to convention, so a scorer has to know that `starred = 85` is a 0-100 rating, `uptime = 99.77` is a measurement and `ownerVerified = 1` is a passed check, not a score of 1/100.

**Live demo:** https://gelenbedalen-art.github.io/erc8004-feedback-semantics/ - enter an agent ID and the page reads its feedback straight from the canonical Reputation Registry on Arc mainnet (`eth_call` only), classifies each entry, and compares it with the ArcID indexer.

This repo has three parts:

1. **A small TypeScript library** that classifies feedback by tag (`rating`, `binary`, `percent`, `duration_ms`, `count`, `currency_usd`, `unknown`). Ratings and 0-100 percentages count toward a rating average; binary flags and measurements in other units (milliseconds, blocks, dollars) do not. Known tags come from the [8004scan Feedback Data Profile](https://best-practices.8004scan.io/docs/02-feedback-standard.html); tags inferred from on-chain data are marked `inferred`. Unknown tags are never guessed: a `strict` policy ignores them, a `compatible` policy treats 0-100 values as ratings and labels that as an assumption.
2. **A read-only chain reader** for the canonical ERC-8004 Reputation Registry (`readAllFeedback`, `getClients`, `getSummary`), with a dependency-free ABI encoder/decoder.
3. **A read-only census** of feedback on Arc as indexed by [ArcID](https://www.arcusid.com/docs), cross-checked entry by entry against the registry, and a report generator.

## Findings (snapshot 2026-10-21)

See [REPORT.md](REPORT.md). All 602 indexer entries were found on-chain with matching tags and revoked status. Two things are misread:

1. **Pass/fail flags averaged as ratings.** ArcID labels 124 binary flags (mostly `metadataVerified = 1`) on 108 agents as 0-100 ratings of 1. All 107 agents whose only feedback is such flags have a Trust Score below the published starting prior of 50 (30.4-46.2); they are 107 of the 124 agents below 50.
2. **Values on the wrong scale.** For 4 entries ArcID's rating is ten times the on-chain value / 10^valueDecimals (for example agent 240: `uptime` 748 with 2 decimals = 7.48%, rated 74.8).

## Use

Requires Node 22.6+ (runs TypeScript directly, no dependencies).

```sh
npm test
npm run census -- data/snapshot-$(date +%F).ndjson   # read-only, throttled; ARC_RPC_URL=none skips the chain check
npm run report -- data/snapshot-YYYY-MM-DD.ndjson REPORT.md
npm run bundle                                        # rebuilds docs/lib.js (the demo page's copy of src/)
```

```ts
import { normalize, summarize, readAllFeedback, ARC } from "./src/index.ts";

normalize({ value: 1, tag1: "ownerVerified" });
// { kind: "binary", passed: true, countsAsRating: false, basis: "documented", ... }

summarize([{ value: 100, tag1: "starred" }, { value: 1, tag1: "metadataVerified" }]).average; // 100

const entries = await readAllFeedback(ARC.mainnet, 240);
summarize(entries.filter((e) => !e.revoked));
```

CI runs the tests, regenerates `REPORT.md` from the committed snapshot and fails on any difference, and checks that `docs/lib.js` matches `src/`. The demo is a static page: open `docs/index.html` in a browser, no build step.

## Scope and limits

- No wallet, keys, signing or transactions. The census calls `GET /v1/stats`, `/v1/agents`, `/v1/agents/:id/feedback` and `eth_call` on the Reputation Registry.
- ArcID's Trust Score formula is not public. The report shows which inputs are misread and the direction of the effect; it does not predict corrected scores.
- The binary meaning of `metadataVerified` and `stbAgentActive` is inferred from tag names and observed values.
- Registry addresses: [docs.arc.io contract addresses](https://docs.arc.io/arc/references/contract-addresses). Function signatures: [erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts).

## License

MIT
