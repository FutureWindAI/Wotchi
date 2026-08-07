import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { consoleNotifier, createWotchi } from "../../src/index.js";
import { registerWotchiProcessMonitor } from "../../src/core/process-monitor.js";

test("process monitor registers and unregisters only the monitor event", () => {
  const client = createWotchi({
    service: "process-test",
    environment: "test",
    notifiers: [consoleNotifier({ write: () => {} })],
  });
  const beforeMonitor = process.listenerCount("uncaughtExceptionMonitor");
  const beforeException = process.listenerCount("uncaughtException");
  const handle = registerWotchiProcessMonitor(client);

  assert.equal(process.listenerCount("uncaughtExceptionMonitor"), beforeMonitor + 1);
  assert.equal(process.listenerCount("uncaughtException"), beforeException);
  handle.unregister();
  assert.equal(process.listenerCount("uncaughtExceptionMonitor"), beforeMonitor);
});

test("process monitor observes a crash without preventing non-zero exit", async () => {
  const testDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
  const sourceIndex = pathToFileURL(resolve(testDirectory, "../src/index.js")).href;
  const childScript = `
    import { consoleNotifier, createWotchi } from ${JSON.stringify(sourceIndex)};
    import { registerWotchiProcessMonitor } from ${JSON.stringify(pathToFileURL(resolve(testDirectory, "../src/core/process-monitor.js")).href)};
    const client = createWotchi({ service: "child", environment: "test", grouping: { alertThreshold: 1 }, notifiers: [consoleNotifier({ write: (line) => process.stdout.write(line + "\\n") })] });
    registerWotchiProcessMonitor(client);
    setTimeout(() => { throw new Error("child monitor failure"); }, 0);
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", childScript], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  const [code] = (await once(child, "exit")) as [number | null, string | null];
  const output = Buffer.concat([...stdout, ...stderr]).toString("utf8");

  assert.notEqual(code, 0);
  assert.equal(output.includes("child monitor failure"), true);
  assert.equal(output.includes("Wotchi — Critical incident"), true);
});
