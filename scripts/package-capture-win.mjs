import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const capture = join(root, "apps", "capture");
const require = createRequire(import.meta.url);

export async function createBuildDirectory(release) {
  const builds = join(release, "builds");
  await mkdir(builds, { recursive: true });
  // A running app or Explorer can lock old output. Never clean or reuse it.
  return mkdtemp(join(builds, "build-"));
}

export function builderArguments(target, output) {
  if (!["dir", "nsis"].includes(target)) throw new Error("Expected dir or nsis target.");
  return ["--win", target, "--x64", "--publish", "never", `--config.directories.output=${output}`];
}

function runNode(script, args, env) {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: capture, env, stdio: "inherit", windowsHide: true
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) accept();
      else reject(new Error(`Packaging command failed (${signal ?? code}).`));
    });
  });
}

async function main() {
  const target = process.argv[2];
  builderArguments(target, "validate");
  if (!process.env.npm_execpath) throw new Error("Run through npm run capture:dist:win or capture:pack:win.");
  const env = {
    ...process.env,
    VITE_API_BASE_URL: "https://api-persuando.gfig.space",
    VITE_WEBSOCKET_URL: "wss://api-persuando.gfig.space/realtime",
    PERSUANDO_API_BASE_URL: "https://api-persuando.gfig.space"
  };
  await runNode(process.env.npm_execpath, ["run", "build"], env);
  const release = join(root, "release", "capture");
  const output = await createBuildDirectory(release);
  console.log(`Fresh packaging directory: ${output}`);
  await runNode(require.resolve("electron-builder/cli.js"), builderArguments(target, output), env);
  const { version } = JSON.parse(await readFile(join(capture, "package.json"), "utf8"));
  const executable = join(output, "win-unpacked", "Persuando Capture.exe");
  let installer;
  if (target === "nsis") {
    const filename = `Persuando-Capture-Setup-${version}.exe`;
    installer = join(output, filename);
    try {
      await copyFile(installer, join(release, filename));
      console.log(`Installer: ${join(release, filename)}`);
    } catch (error) {
      console.warn(`Could not refresh the convenience copy (${error.code}). Use: ${installer}`);
    }
  }
  await writeFile(join(release, "latest-build.json"), JSON.stringify({
    version, target, executable, installer, output
  }, null, 2) + "\n");
  console.log(`Executable: ${executable}`);
  if (installer) console.log(`Build installer: ${installer}`);
  console.log("Build complete. Paths saved in release/capture/latest-build.json.");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
