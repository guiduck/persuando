import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ignored = new Set([".git", "node_modules", "dist", ".next", "coverage"]);
const checkedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json"]);
const problems = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf("."));
    if (!checkedExtensions.has(ext)) continue;
    const text = await readFile(path, "utf8");
    if (/\t/.test(text)) problems.push(`${path}: contains tab indentation`);
    if (/[ \t]$/m.test(text)) problems.push(`${path}: contains trailing whitespace`);
  }
}

await walk(process.cwd());

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("lint: basic whitespace checks passed");
