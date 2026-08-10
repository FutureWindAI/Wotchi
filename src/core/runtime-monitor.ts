import type { WotchiClient } from "./types.js";

export interface WotchiRuntimeWatcherOptions {
  intervalMs?: number;
  cpuPercent?: number;
  rssBytes?: number;
  heapUsedBytes?: number;
  eventLoopDelayMs?: number;
  pendingAlerts?: number;
  notifierFailures?: number;
  alertThreshold?: number;
}

export interface WotchiRuntimeWatcherHandle {
  unregister(): void;
}

const DEFAULT_INTERVAL_MS = 5_000;
const MIN_INTERVAL_MS = 100;
const MAX_INTERVAL_MS = 60_000;
const MAX_THRESHOLD = Number.MAX_SAFE_INTEGER;

const positiveNumber = (value: number | undefined, fallback: number, field: string): number => {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value) || value <= 0 || value > MAX_THRESHOLD) {
    throw new RangeError(`${field} must be a positive finite number`);
  }
  return value;
};

export function registerWotchiRuntimeWatcher(
  client: Pick<WotchiClient, "captureEvent" | "getDiagnostics">,
  options: WotchiRuntimeWatcherOptions = {},
): WotchiRuntimeWatcherHandle {
  const intervalMs = positiveNumber(options.intervalMs, DEFAULT_INTERVAL_MS, "intervalMs");
  if (
    !Number.isSafeInteger(intervalMs) ||
    intervalMs < MIN_INTERVAL_MS ||
    intervalMs > MAX_INTERVAL_MS
  ) {
    throw new RangeError(
      `intervalMs must be an integer from ${MIN_INTERVAL_MS} to ${MAX_INTERVAL_MS}`,
    );
  }
  const thresholds = {
    cpuPercent: options.cpuPercent,
    rssBytes: options.rssBytes,
    heapUsedBytes: options.heapUsedBytes,
    eventLoopDelayMs: options.eventLoopDelayMs,
    pendingAlerts: options.pendingAlerts,
    notifierFailures: options.notifierFailures,
  };
  for (const [field, value] of Object.entries(thresholds)) {
    if (value !== undefined) {
      positiveNumber(value, 1, field);
    }
  }
  const alertThreshold = options.alertThreshold ?? 3;
  if (!Number.isSafeInteger(alertThreshold) || alertThreshold <= 0 || alertThreshold > 1_000_000) {
    throw new RangeError("alertThreshold must be a positive integer no greater than 1000000");
  }

  let previousCpu = process.cpuUsage();
  let previousTime = process.hrtime.bigint();
  let previousNotifierFailures = client.getDiagnostics().notifierFailures;
  let expectedAt = Date.now() + intervalMs;
  let registered = true;

  const sample = (): void => {
    if (!registered) {
      return;
    }
    const timestamp = Date.now();
    const elapsedMicros = Math.max(1, Number(process.hrtime.bigint() - previousTime) / 1_000);
    const cpu = process.cpuUsage(previousCpu);
    previousCpu = process.cpuUsage();
    previousTime = process.hrtime.bigint();
    const memory = process.memoryUsage();
    const eventLoopDelayMs = Math.max(0, timestamp - expectedAt);
    expectedAt = timestamp + intervalMs;
    const cpuPercent = ((cpu.user + cpu.system) / elapsedMicros) * 100;
    const diagnostics = client.getDiagnostics();
    const notifierFailures = Math.max(0, diagnostics.notifierFailures - previousNotifierFailures);
    previousNotifierFailures = diagnostics.notifierFailures;
    const readings: ReadonlyArray<{
      metric: string;
      value: number;
      threshold: number | undefined;
    }> = [
      { metric: "cpu-percent", value: cpuPercent, threshold: thresholds.cpuPercent },
      { metric: "rss-bytes", value: memory.rss, threshold: thresholds.rssBytes },
      { metric: "heap-used-bytes", value: memory.heapUsed, threshold: thresholds.heapUsedBytes },
      {
        metric: "event-loop-delay-ms",
        value: eventLoopDelayMs,
        threshold: thresholds.eventLoopDelayMs,
      },
      { metric: "pending-alerts", value: 0, threshold: thresholds.pendingAlerts },
      {
        metric: "notifier-failures",
        value: notifierFailures,
        threshold: thresholds.notifierFailures,
      },
    ];
    for (const reading of readings) {
      const value = reading.metric === "pending-alerts" ? diagnostics.pendingAlerts : reading.value;
      if (reading.threshold === undefined || value < reading.threshold) {
        continue;
      }
      client.captureEvent({
        level: "error",
        kind: "runtime-monitor",
        message: `Wotchi runtime pressure: ${reading.metric}`,
        fingerprint: `wotchi.runtime.${reading.metric}`,
        severity: "high",
        alertThreshold,
        context: {
          metric: reading.metric,
          value: Math.round(value * 100) / 100,
          threshold: reading.threshold,
        },
      });
    }
  };

  const timer = setInterval(sample, intervalMs);
  timer.unref?.();
  return {
    unregister: () => {
      if (!registered) {
        return;
      }
      registered = false;
      clearInterval(timer);
    },
  };
}
