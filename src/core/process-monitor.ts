import type { WotchiClient } from "./types.js";

export interface ProcessMonitorHandle {
  unregister(): void;
}

export function registerWotchiProcessMonitor(client: WotchiClient): ProcessMonitorHandle {
  const listener = (error: Error, origin: string): void => {
    try {
      client.captureEvent({
        level: "error",
        kind: "process-monitor",
        message: "Uncaught process exception",
        error,
        context: { processOrigin: origin },
      });
    } catch {
      // Process monitoring must never alter the host process crash behavior.
    }
  };
  globalThis.process.on("uncaughtExceptionMonitor", listener);
  let registered = true;
  return {
    unregister(): void {
      if (!registered) {
        return;
      }
      registered = false;
      globalThis.process.off("uncaughtExceptionMonitor", listener);
    },
  };
}
