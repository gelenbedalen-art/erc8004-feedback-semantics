/**
 * Builds REPORT.md from a census snapshot. Re-running it on the same file always gives the same report.
 *
 * Usage: node --experimental-strip-types scripts/report.ts data/snapshot-YYYY-MM-DD.ndjson [REPORT.md]
 */
import { readFile, writeFile } from "node:fs/promises";
import { analyze } from "../src/analyze.ts";
import { fromNdjson } from "../src/ndjson.ts";
import { render } from "../src/report.ts";

const [input, output = "REPORT.md"] = process.argv.slice(2);
if (!input) {
  console.error("usage: report.ts <snapshot.ndjson> [REPORT.md]");
  process.exit(2);
}

const snapshot = fromNdjson(await readFile(input, "utf8"));
const name = input.split("/").pop() ?? input;
await writeFile(output, render(analyze(snapshot), name));
console.error(`wrote ${output}`);
