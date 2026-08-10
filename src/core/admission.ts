export interface CaptureAdmissionOptions {
  maxEventsPerSecond: number;
  burst: number;
  now?: () => number;
}

export interface CaptureAdmission {
  tryAcquire(): boolean;
}

/** A small token bucket used before normalization to bound overload work. */
export function createCaptureAdmission(options: CaptureAdmissionOptions): CaptureAdmission {
  const now = options.now ?? Date.now;
  let tokens = options.burst;
  let lastRefill = now();

  return {
    tryAcquire: () => {
      const timestamp = now();
      const elapsedMs = Math.max(0, timestamp - lastRefill);
      tokens = Math.min(options.burst, tokens + (elapsedMs * options.maxEventsPerSecond) / 1_000);
      lastRefill = timestamp;
      if (tokens < 1) {
        return false;
      }
      tokens -= 1;
      return true;
    },
  };
}
