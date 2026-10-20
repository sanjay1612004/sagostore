import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// Start both services as one development task and stop both on exit, so an
// apparently healthy API cannot silently leave speech jobs without a worker.
export function startDevServices({
  spawnProcess = spawn,
  onExit = (code) => {
    process.exitCode = code;
  },
} = {}) {
  const cwd = fileURLToPath(new URL("../server/", import.meta.url));
  const cli = fileURLToPath(
    new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
  );
  let stopping = false;
  let status = 0;
  const children = [];
  const live = new Set();
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    status = code;
    for (const child of live) child.kill("SIGTERM");
  };
  for (const entry of ["src/server.ts", "src/workers/voice.ts"]) {
    const child = spawnProcess(
      process.execPath,
      [cli, "watch", "--env-file-if-exists=.env", entry],
      { cwd, stdio: "inherit" },
    );
    children.push(child);
    live.add(child);
    const finish = (code) => {
      if (!live.delete(child)) return;
      if (!stopping) stop(code || 1);
      if (!live.size) onExit(status);
    };
    child.once("error", () => finish(1));
    child.once("exit", finish);
  }
  return { stop, children };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const services = startDevServices();
  process.once("SIGINT", () => services.stop());
  process.once("SIGTERM", () => services.stop());
}
