import { normalizeUnknown } from "./normalize.js";
import { MAX_EVENTS_PER_WINDOW, MAX_GROUPS } from "./limits.js";
import { createRollingWindow } from "./rolling-window.js";
import type { IncidentGroup, IncidentSeverity, SafeErrorEvent } from "./types.js";

export interface GroupStoreOptions {
  maxGroups: number;
  maxEventsPerWindow: number;
  windowMs: number;
  now?: () => number;
}

export interface GroupStore {
  record(fingerprint: string, event: SafeErrorEvent, severity?: IncidentSeverity): IncidentGroup;
  get(fingerprint: string): IncidentGroup | undefined;
  markAlerted(fingerprint: string, timestamp?: number): IncidentGroup | undefined;
  size(): number;
  groupsEvicted(): number;
}

interface StoredGroup {
  fingerprint: string;
  firstSeenMs: number;
  lastSeenMs: number;
  totalCount: number;
  sample: SafeErrorEvent;
  severity: IncidentSeverity;
  lastAlertedMs?: number;
  window: ReturnType<typeof createRollingWindow>;
}

const cloneSafeEvent = (event: SafeErrorEvent): SafeErrorEvent => {
  const context = event.context === undefined ? undefined : normalizeUnknown(event.context);
  return {
    id: event.id,
    timestamp: event.timestamp,
    service: event.service,
    environment: event.environment,
    ...(event.instance === undefined ? {} : { instance: event.instance }),
    ...(event.release === undefined ? {} : { release: event.release }),
    ...(event.correlationId === undefined ? {} : { correlationId: event.correlationId }),
    ...(event.operation === undefined ? {} : { operation: event.operation }),
    ...(event.job === undefined ? {} : { job: event.job }),
    ...(event.tags === undefined ? {} : { tags: { ...event.tags } }),
    error: { ...event.error },
    ...(event.request === undefined ? {} : { request: { ...event.request } }),
    ...(event.trace === undefined ? {} : { trace: { ...event.trace } }),
    ...(context === undefined ? {} : { context: context as Record<string, unknown> }),
  };
};

export function createGroupStore(options: GroupStoreOptions): GroupStore {
  if (
    !Number.isSafeInteger(options.maxGroups) ||
    options.maxGroups <= 0 ||
    options.maxGroups > MAX_GROUPS
  ) {
    throw new RangeError("maxGroups must be a positive integer");
  }
  if (
    !Number.isSafeInteger(options.maxEventsPerWindow) ||
    options.maxEventsPerWindow <= 0 ||
    options.maxEventsPerWindow > MAX_EVENTS_PER_WINDOW
  ) {
    throw new RangeError("maxEventsPerWindow must be a positive integer");
  }
  const now = options.now ?? Date.now;
  const groups = new Map<string, StoredGroup>();
  let evicted = 0;

  const snapshot = (group: StoredGroup): IncidentGroup => ({
    fingerprint: group.fingerprint,
    firstSeenAt: new Date(group.firstSeenMs).toISOString(),
    lastSeenAt: new Date(group.lastSeenMs).toISOString(),
    totalCount: group.totalCount,
    windowCount: group.window.count(group.lastSeenMs),
    sample: cloneSafeEvent(group.sample),
    ...(group.lastAlertedMs === undefined
      ? {}
      : { lastAlertedAt: new Date(group.lastAlertedMs).toISOString() }),
    severity: group.severity,
  });

  const evictLeastRecent = (): void => {
    let candidate: StoredGroup | undefined;
    for (const group of groups.values()) {
      if (candidate === undefined || group.lastSeenMs < candidate.lastSeenMs) {
        candidate = group;
      }
    }
    if (candidate !== undefined) {
      groups.delete(candidate.fingerprint);
      evicted += 1;
    }
  };

  const record = (
    fingerprint: string,
    event: SafeErrorEvent,
    severity: IncidentSeverity = "medium",
  ): IncidentGroup => {
    const timestamp = now();
    let group = groups.get(fingerprint);
    if (group === undefined) {
      if (groups.size >= options.maxGroups) {
        evictLeastRecent();
      }
      group = {
        fingerprint,
        firstSeenMs: timestamp,
        lastSeenMs: timestamp,
        totalCount: 0,
        sample: cloneSafeEvent(event),
        severity,
        window: createRollingWindow({
          maxEvents: options.maxEventsPerWindow,
          windowMs: options.windowMs,
          now,
        }),
      };
      groups.set(fingerprint, group);
    }
    group.lastSeenMs = timestamp;
    group.totalCount += 1;
    group.severity = severity;
    group.window.add(timestamp);
    return snapshot(group);
  };

  return {
    record,
    get: (fingerprint) => {
      const group = groups.get(fingerprint);
      return group === undefined ? undefined : snapshot(group);
    },
    markAlerted: (fingerprint, timestamp = now()) => {
      const group = groups.get(fingerprint);
      if (group === undefined) {
        return undefined;
      }
      group.lastAlertedMs = timestamp;
      return snapshot(group);
    },
    size: () => groups.size,
    groupsEvicted: () => evicted,
  };
}
