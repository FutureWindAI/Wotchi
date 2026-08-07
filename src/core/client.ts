import { validateConfig } from "./config.js";
import { createDiagnosticsState, snapshotDiagnostics } from "./diagnostics.js";
import { fingerprintSafeErrorEvent } from "./fingerprint.js";
import { createGroupStore } from "./group-store.js";
import { buildIncidentAlert } from "./incident-builder.js";
import { evaluateIncidentPolicy } from "./incident-policy.js";
import type { IncidentEventKind } from "./incident-policy.js";
import { normalizeError, normalizeUnknown } from "./normalize.js";
import { createNotificationQueue } from "./notification-queue.js";
import { redactError, redactValue } from "./redact.js";
import type { SafeNormalizedValue } from "./normalize.js";
import type {
  SafeErrorEvent,
  WotchiClient,
  WotchiConfig,
  WotchiEventInput,
  WotchiRequestContext,
} from "./types.js";

const isRecord = (value: SafeNormalizedValue): value is { [key: string]: SafeNormalizedValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: SafeNormalizedValue | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

const asStatusCode = (value: SafeNormalizedValue | undefined): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;

const safeRecord = (
  value: unknown,
  privacy: ReturnType<typeof validateConfig>["privacy"],
): Record<string, unknown> | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const redacted = redactValue(value, privacy);
  return isRecord(redacted) ? (redacted as Record<string, unknown>) : undefined;
};

const mergeContext = (
  metadata: unknown,
  context: unknown,
  privacy: ReturnType<typeof validateConfig>["privacy"],
): Record<string, unknown> | undefined => {
  if (metadata === undefined && context === undefined) {
    return undefined;
  }
  const metadataValue = safeRecord(metadata, privacy);
  const contextValue = safeRecord(context, privacy);
  if (metadataValue === undefined && contextValue === undefined) {
    return undefined;
  }
  return { ...(metadataValue ?? {}), ...(contextValue ?? {}) };
};

const safeRequest = (
  request: unknown,
  privacy: ReturnType<typeof validateConfig>["privacy"],
): WotchiRequestContext | undefined => {
  if (request === undefined) {
    return undefined;
  }
  const redacted = redactValue(request, privacy);
  if (!isRecord(redacted)) {
    return undefined;
  }
  const method = asString(redacted.method);
  const route = asString(redacted.route);
  const requestId = asString(redacted.requestId);
  const statusCode = asStatusCode(redacted.statusCode);
  if (
    method === undefined &&
    route === undefined &&
    requestId === undefined &&
    statusCode === undefined
  ) {
    return undefined;
  }
  return {
    ...(method === undefined ? {} : { method }),
    ...(route === undefined ? {} : { route }),
    ...(requestId === undefined ? {} : { requestId }),
    ...(statusCode === undefined ? {} : { statusCode }),
  };
};

const safeMessage = (
  value: unknown,
  privacy: ReturnType<typeof validateConfig>["privacy"],
): string => {
  const normalized = normalizeUnknown(value, privacy);
  return typeof normalized === "string" ? normalized : "[unreadable value]";
};

export function createWotchi(config: WotchiConfig): WotchiClient {
  const normalized = validateConfig(config);
  const now = Date.now;
  const groupStore = createGroupStore({
    maxGroups: normalized.grouping.maxGroups,
    maxEventsPerWindow: normalized.grouping.maxEventsPerWindow,
    windowMs: normalized.grouping.windowMs,
    now,
  });
  const diagnostics = createDiagnosticsState();
  const queue = createNotificationQueue({
    maxPendingAlerts: normalized.queue.maxPendingAlerts,
    concurrency: normalized.queue.concurrency,
  });
  const privacy = normalized.privacy;
  let eventSequence = 0;

  const captureSafeEvent = (
    error: unknown,
    metadata: unknown,
    context: unknown,
    request: unknown,
    eventKind: IncidentEventKind = "error",
  ): void => {
    const timestamp = now();
    const safeError = redactError(normalizeError(error, privacy), privacy);
    const requestContext = safeRequest(request, privacy);
    const eventContext = mergeContext(metadata, context, privacy);
    const safeEvent: SafeErrorEvent = {
      id: `event-${eventSequence + 1}`,
      timestamp: new Date(timestamp).toISOString(),
      service: normalized.service,
      environment: normalized.environment,
      ...(normalized.release === undefined ? {} : { release: normalized.release }),
      error: safeError,
      ...(requestContext === undefined ? {} : { request: requestContext }),
      ...(eventContext === undefined ? {} : { context: eventContext }),
    };
    eventSequence += 1;

    const fingerprint = fingerprintSafeErrorEvent(safeEvent);
    const group = groupStore.record(fingerprint, safeEvent);
    const decision = evaluateIncidentPolicy({
      group,
      now: timestamp,
      alertThreshold: normalized.grouping.alertThreshold,
      cooldownMs: normalized.grouping.cooldownMs,
      eventKind,
    });
    if (decision.shouldAlert) {
      const alert = buildIncidentAlert(group, decision);
      if (queue.enqueue(alert, normalized.notifiers)) {
        groupStore.markAlerted(fingerprint, timestamp);
      }
    }
    diagnostics.capturedEvents += 1;
  };

  const captureException = (error: unknown, context?: Record<string, unknown>): void => {
    if (!normalized.enabled) {
      return;
    }
    try {
      captureSafeEvent(error, undefined, context, undefined);
    } catch {
      diagnostics.captureFailures += 1;
    }
  };

  const captureEvent = (event: WotchiEventInput): void => {
    if (!normalized.enabled) {
      return;
    }
    try {
      if (event === null || typeof event !== "object" || event.level !== "error") {
        throw new TypeError("event.level must be error");
      }
      if (typeof event.message !== "string") {
        throw new TypeError("event.message must be a string");
      }
      captureSafeEvent(
        event.error ?? safeMessage(event.message, privacy),
        event.metadata,
        event.context,
        event.request,
        event.kind ?? "error",
      );
    } catch {
      diagnostics.captureFailures += 1;
    }
  };

  return {
    captureException,
    captureEvent,
    flush: (timeoutMs?: number) => queue.flush(timeoutMs),
    getDiagnostics: () =>
      snapshotDiagnostics(diagnostics, {
        groupsEvicted: groupStore.groupsEvicted(),
        alertsQueued: queue.alertsQueued(),
        alertsDropped: queue.alertsDropped(),
        alertsSent: queue.alertsSent(),
        notifierFailures: queue.notifierFailures(),
        activeGroups: groupStore.size(),
        pendingAlerts: queue.pending(),
      }),
  };
}
