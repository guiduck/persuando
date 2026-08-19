import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ignored = new Set([".git", "node_modules", "dist", ".next", "coverage"]);
const problems = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (/^client_secret.*\.json$/.test(entry.name)) continue;
    if (!/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) continue;
    const text = await readFile(path, "utf8");
    if (!text.endsWith("\n")) problems.push(`${path}: missing final newline`);
  }
}

await walk(process.cwd());

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("format: final newline checks passed");
