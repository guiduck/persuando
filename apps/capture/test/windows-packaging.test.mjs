import assert from "node:assert/strict";
import { mkdtemp, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { builderArguments, createBuildDirectory } from "../../../scripts/package-capture-win.mjs";

test("Windows npm commands retain the lock-safe packaging entrypoint", async () => {
  const capture = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const root = JSON.parse(await readFile(new URL("../../../package.json", import.meta.url), "utf8"));
  assert.equal(capture.scripts["pack:win"], "node ../../scripts/package-capture-win.mjs dir");
  assert.equal(capture.scripts["dist:win"], "node ../../scripts/package-capture-win.mjs nsis");
  assert.equal(root.scripts["capture:pack:win"], "npm run --workspace @persuando/capture pack:win");
  assert.equal(root.scripts["capture:dist:win"], "npm run --workspace @persuando/capture dist:win");
});

test("both targets override builder output with a fresh path and never publish", () => {
  const output = join(tmpdir(), "build with spaces");
  for (const target of ["dir", "nsis"]) {
    const args = builderArguments(target, output);
    assert.deepEqual(args, ["--win", target, "--x64", "--publish", "never", `--config.directories.output=${output}`]);
  }
  assert.throws(() => builderArguments("invalid", output));
});

test("repeated packaging preserves an existing open app and earlier build outputs", async (t) => {
  const release = await mkdtemp(join(tmpdir(), "persuando packaging-"));
  t.after(() => rm(release, { recursive: true, force: true }));
  const old = join(release, "win-unpacked");
  await mkdir(old);
  const executable = join(old, "Persuando Capture.exe");
  await writeFile(executable, "existing application");
  const handle = await open(executable, "r");
  try {
    const first = await createBuildDirectory(release);
    await writeFile(join(first, "previous-build"), "preserve");
    const second = await createBuildDirectory(release);
    assert.notEqual(first, second);
    assert.equal(await readFile(executable, "utf8"), "existing application");
    assert.equal(await readFile(join(first, "previous-build"), "utf8"), "preserve");
    assert.equal(dirname(second), join(release, "builds"));
  } finally {
    await handle.close();
  }
});
