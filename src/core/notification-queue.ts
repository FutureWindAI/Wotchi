import type { IncidentAlert, WotchiNotifier } from "./types.js";

export interface NotificationQueueOptions {
  maxPendingAlerts: number;
  concurrency: 1;
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
  pending(): number;
  alertsQueued(): number;
  alertsDropped(): number;
  alertsSent(): number;
  notifierFailures(): number;
}

interface NotificationJob {
  alert: IncidentAlert;
  notifiers: readonly WotchiNotifier[];
  onComplete?: (result: NotificationJobResult) => void;
}

const DEFAULT_FLUSH_TIMEOUT_MS = 5_000;

export function createNotificationQueue(options: NotificationQueueOptions): NotificationQueue {
  if (!Number.isSafeInteger(options.maxPendingAlerts) || options.maxPendingAlerts <= 0) {
    throw new RangeError("maxPendingAlerts must be a positive integer");
  }
  if (options.concurrency !== 1) {
    throw new RangeError("concurrency must be 1");
  }

  const pendingJobs: NotificationJob[] = [];
  let drainPromise: Promise<void> | undefined;
  let resolveDrain: (() => void) | undefined;
  let activeJobs = 0;
  let queued = 0;
  let dropped = 0;
  let sent = 0;
  let failures = 0;

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
    let jobSent = 0;
    let jobFailures = 0;
    for (const notifier of job.notifiers) {
      try {
        await notifier.send(job.alert);
        sent += 1;
        jobSent += 1;
      } catch (error: unknown) {
        jobFailures += 1;
        notifyFailure(error, notifier);
      }
    }
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
    if (pendingJobs.length >= options.maxPendingAlerts) {
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
    pending: () => pendingJobs.length,
    alertsQueued: () => queued,
    alertsDropped: () => dropped,
    alertsSent: () => sent,
    notifierFailures: () => failures,
  };
}
