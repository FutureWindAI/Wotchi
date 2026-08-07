import { performance } from "node:perf_hooks";
import { createWotchi } from "../dist/esm/index.js";

const LATENCY_P95_MS = 1;
const LATENCY_P99_MS = 2;
const DUPLICATE_HEAP_LIMIT = 10 * 1024 * 1024;
const UNIQUE_HEAP_LIMIT = 20 * 1024 * 1024;
const notifier = { name: "benchmark", send: async () => {} };

const createClient = (overrides = {}) =>
  createWotchi({
    service: "benchmark",
    environment: "local",
    grouping: {
      alertThreshold: 100_000,
      maxGroups: 200,
      maxEventsPerWindow: 100,
      ...overrides,
    },
    notifiers: [notifier],
  });

const percentile = (values, ratio) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
};

const measure = (callback, iterations) => {
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    callback(index);
  }
  return performance.now() - start;
};

const latencyRun = () => {
  const client = createClient();
  const error = new Error("benchmark error with a bounded one kilobyte payload");
  const samples = [];
  const iterations = 100;
  const warmup = 100;
  for (let index = 0; index < warmup; index += 1) {
    client.captureException(error, { payload: "x".repeat(900) });
  }
  for (let sample = 0; sample < 5; sample += 1) {
    const baseline = measure(() => {}, iterations);
    const elapsed = measure(() => {
      client.captureException(error, { payload: "x".repeat(900) });
    }, iterations);
    samples.push(Math.max(0, (elapsed - baseline) / iterations));
  }
  return samples;
};

const heapDelta = (count, unique) => {
  if (typeof globalThis.gc !== "function") {
    throw new Error("Run benchmarks with --expose-gc to measure heap budgets");
  }
  const client = createClient();
  globalThis.gc();
  const before = globalThis.process.memoryUsage().heapUsed;
  for (let index = 0; index < count; index += 1) {
    const error = unique
      ? new Error(`unique benchmark error ${index}`)
      : new Error("duplicate benchmark error");
    client.captureException(error);
  }
  globalThis.gc();
  return globalThis.process.memoryUsage().heapUsed - before;
};

const latencySamples = latencyRun();
const p95 = percentile(latencySamples, 0.95);
const p99 = percentile(latencySamples, 0.99);
const duplicateHeap = heapDelta(10_000, false);
const uniqueHeap = heapDelta(1_000, true);
const result = {
  node: globalThis.process.version,
  platform: globalThis.process.platform,
  arch: globalThis.process.arch,
  latencySamplesMs: latencySamples.map((value) => Number(value.toFixed(4))),
  captureP95Ms: Number(p95.toFixed(4)),
  captureP99Ms: Number(p99.toFixed(4)),
  duplicateHeapDeltaMiB: Number((duplicateHeap / 1024 / 1024).toFixed(3)),
  uniqueHeapDeltaMiB: Number((uniqueHeap / 1024 / 1024).toFixed(3)),
};
globalThis.console.log(JSON.stringify(result, null, 2));

if (p95 >= LATENCY_P95_MS || p99 >= LATENCY_P99_MS) {
  throw new Error(`Capture latency budget failed: p95=${p95}ms p99=${p99}ms`);
}
if (duplicateHeap >= DUPLICATE_HEAP_LIMIT || uniqueHeap >= UNIQUE_HEAP_LIMIT) {
  throw new Error(
    `Heap budget failed: duplicate=${duplicateHeap} bytes unique=${uniqueHeap} bytes`,
  );
}
