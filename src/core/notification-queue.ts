import type { IncidentAlert, WotchiNotifier } from "./types.js";
import {
  MAX_CIRCUIT_BREAKER_COOLDOWN_MS,
  MAX_CIRCUIT_BREAKER_FAILURES,
  MAX_NOTIFIER_TIMEOUT_MS,
  MAX_PENDING_ALERTS,
} from "./limits.js";

export interface NotificationQueueOptions {
  maxPendingAlerts: number;
  concurrency: 1;
  notifierTimeoutMs?: number;
  notifierCircuitBreaker?: {
    failureThreshold: number;
    cooldownMs: number;
  };
  onNotifierError?: (error: unknown, notifier: WotchiNotifier) => void;
}

export interface NotificationJobResult {
  notifierFailures: number;
  sent: number;
}

export interface NotificationQueue {
  enqueue(
    alert: IncidentAlert,
    notifiers: readonly WotchiNotifier[],
    onComplete?: (result: NotificationJobResult) => void,
  ): boolean;
  flush(timeoutMs?: number): Promise<void>;
  close(timeoutMs?: number): Promise<void>;
  isClosed(): boolean;
  pending(): number;
  alertsQueued(): number;
  alertsDropped(): number;
  alertsSent(): number;
  notifierFailures(): number;
  notifierTimeouts(): number;
  notifierCircuitOpenSkips(): number;
}

interface NotificationJob {
  alert: IncidentAlert;
  notifiers: readonly WotchiNotifier[];
  onComplete?: (result: NotificationJobResult) => void;
}

const DEFAULT_FLUSH_TIMEOUT_MS = 5_000;
const DEFAULT_NOTIFIER_TIMEOUT_MS = 5_000;
const DEFAULT_CIRCUIT_FAILURE_THRESHOLD = 3;
const DEFAULT_CIRCUIT_COOLDOWN_MS = 30_000;

export function createNotificationQueue(options: NotificationQueueOptions): NotificationQueue {
  if (
    !Number.isSafeInteger(options.maxPendingAlerts) ||
    options.maxPendingAlerts <= 0 ||
    options.maxPendingAlerts > MAX_PENDING_ALERTS
  ) {
    throw new RangeError("maxPendingAlerts must be a positive integer");
  }
  if (options.concurrency !== 1) {
    throw new RangeError("concurrency must be 1");
  }
  if (
    options.notifierTimeoutMs !== undefined &&
    (!Number.isSafeInteger(options.notifierTimeoutMs) ||
      options.notifierTimeoutMs <= 0 ||
      options.notifierTimeoutMs > MAX_NOTIFIER_TIMEOUT_MS)
  ) {
    throw new RangeError("notifierTimeoutMs must be a positive integer");
  }
  if (options.notifierCircuitBreaker !== undefined) {
    const { failureThreshold, cooldownMs } = options.notifierCircuitBreaker;
    if (
      !Number.isSafeInteger(failureThreshold) ||
      failureThreshold <= 0 ||
      failureThreshold > MAX_CIRCUIT_BREAKER_FAILURES ||
      !Number.isSafeInteger(cooldownMs) ||
      cooldownMs <= 0 ||
      cooldownMs > MAX_CIRCUIT_BREAKER_COOLDOWN_MS
    ) {
      throw new RangeError("notifierCircuitBreaker limits are invalid");
    }
  }

  const pendingJobs: NotificationJob[] = [];
  let drainPromise: Promise<void> | undefined;
  let resolveDrain: (() => void) | undefined;
  let activeJobs = 0;
  let queued = 0;
  let dropped = 0;
  let sent = 0;
  let failures = 0;
  let timeouts = 0;
  let circuitOpenSkips = 0;
  let closed = false;
  const notifierStates = new Map<WotchiNotifier, { failures: number; openUntil: number }>();
  const notifierTimeoutMs = options.notifierTimeoutMs ?? DEFAULT_NOTIFIER_TIMEOUT_MS;
  const circuit = options.notifierCircuitBreaker ?? {
    failureThreshold: DEFAULT_CIRCUIT_FAILURE_THRESHOLD,
    cooldownMs: DEFAULT_CIRCUIT_COOLDOWN_MS,
  };

  const notifyFailure = (error: unknown, notifier: WotchiNotifier): void => {
    failures += 1;
    try {
      options.onNotifierError?.(error, notifier);
    } catch {
      // Diagnostics callbacks cannot be allowed to affect the host application.
    }
  };

  const resolveDrainWaiters = (): void => {
    if (activeJobs !== 0 || pendingJobs.length !== 0) {
      return;
    }
    resolveDrain?.();
    drainPromise = undefined;
    resolveDrain = undefined;
  };

  const processJob = async (job: NotificationJob): Promise<void> => {
    const results = await Promise.all(
      job.notifiers.map(async (notifier) => {
        const state = notifierStates.get(notifier) ?? { failures: 0, openUntil: 0 };
        const timestamp = Date.now();
        if (state.openUntil > timestamp) {
          circuitOpenSkips += 1;
          notifyFailure(new Error(`Notifier circuit is open: ${notifier.name}`), notifier);
          return { sent: 0, failed: 1 };
        }
        if (state.openUntil !== 0) {
          state.openUntil = 0;
          state.failures = 0;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              timeouts += 1;
              reject(
                new Error(`Notifier timed out after ${notifierTimeoutMs}ms: ${notifier.name}`),
              );
            }, notifierTimeoutMs);
            timer.unref?.();
          });
          await Promise.race([notifier.send(job.alert), timeout]);
          if (timer !== undefined) {
            clearTimeout(timer);
          }
          state.failures = 0;
          notifierStates.set(notifier, state);
          sent += 1;
          return { sent: 1, failed: 0 };
        } catch (error: unknown) {
          if (timer !== undefined) {
            clearTimeout(timer);
          }
          state.failures += 1;
          if (state.failures >= circuit.failureThreshold) {
            state.openUntil = Date.now() + circuit.cooldownMs;
          }
          notifierStates.set(notifier, state);
          notifyFailure(error, notifier);
          return { sent: 0, failed: 1 };
        }
      }),
    );
    const jobSent = results.reduce((total, result) => total + result.sent, 0);
    const jobFailures = results.reduce((total, result) => total + result.failed, 0);
    try {
      job.onComplete?.({ notifierFailures: jobFailures, sent: jobSent });
    } catch {
      // Job observers cannot be allowed to affect notification processing.
    }
  };

  const pump = (): void => {
    while (activeJobs < options.concurrency && pendingJobs.length > 0) {
      const job = pendingJobs.shift();
      if (job === undefined) {
        break;
      }
      activeJobs += 1;
      void processJob(job).finally(() => {
        activeJobs -= 1;
        pump();
        resolveDrainWaiters();
      });
    }
  };

  const enqueue = (
    alert: IncidentAlert,
    notifiers: readonly WotchiNotifier[],
    onComplete?: (result: NotificationJobResult) => void,
  ): boolean => {
    if (closed || pendingJobs.length >= options.maxPendingAlerts) {
      dropped += 1;
      return false;
    }
    pendingJobs.push({
      alert,
      notifiers: [...notifiers],
      ...(onComplete === undefined ? {} : { onComplete }),
    });
    queued += 1;
    pump();
    return true;
  };

  const close = (timeoutMs = DEFAULT_FLUSH_TIMEOUT_MS): Promise<void> => {
    closed = true;
    return flush(timeoutMs);
  };

  const flush = (timeoutMs = DEFAULT_FLUSH_TIMEOUT_MS): Promise<void> => {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(new RangeError("timeoutMs must be a positive integer"));
    }
    if (activeJobs === 0 && pendingJobs.length === 0) {
      return Promise.resolve();
    }
    const drain =
      drainPromise ??
      new Promise<void>((resolve) => {
        resolveDrain = resolve;
      });
    drainPromise = drain;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Wotchi notification queue flush timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      void drain.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  };

  return {
    enqueue,
    flush,
    close,
    isClosed: () => closed,
    pending: () => pendingJobs.length,
    alertsQueued: () => queued,
    alertsDropped: () => dropped,
    alertsSent: () => sent,
    notifierFailures: () => failures,
    notifierTimeouts: () => timeouts,
    notifierCircuitOpenSkips: () => circuitOpenSkips,
  };
}
