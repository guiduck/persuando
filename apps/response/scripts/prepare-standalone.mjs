import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const responseRoot = resolve(import.meta.dirname, "..");
const standaloneRoot = resolve(responseRoot, ".next", "standalone", "apps", "response");

await mkdir(resolve(standaloneRoot, ".next"), { recursive: true });
await cp(resolve(responseRoot, "public"), resolve(standaloneRoot, "public"), {
  force: true,
  recursive: true
});
await cp(resolve(responseRoot, ".next", "static"), resolve(standaloneRoot, ".next", "static"), {
  force: true,
  recursive: true
});

console.info("Prepared Response standalone bundle with public and static assets.");
