import { validateConfig } from "./config.js";
import { createCaptureAdmission } from "./admission.js";
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
  IncidentAlert,
  IncidentSeverity,
  SafeErrorEvent,
  WotchiClient,
  WotchiConfig,
  WotchiCaptureOptions,
  WotchiEventInput,
  WotchiFingerprintOverride,
  WotchiTestAlertResult,
  WotchiTags,
  WotchiDiagnostics,
  WotchiRequestContext,
  WotchiTraceContext,
} from "./types.js";

const isRecord = (value: SafeNormalizedValue): value is { [key: string]: SafeNormalizedValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asStatusCode = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
};

const safeTrace = (
  value: unknown,
  privacy: ReturnType<typeof validateConfig>["privacy"],
): WotchiTraceContext | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const redacted = redactValue(value, privacy);
  if (!isRecord(redacted)) {
    return undefined;
  }
  const traceId = asString(redacted.traceId);
  const spanId = asString(redacted.spanId);
  if (traceId === undefined && spanId === undefined) {
    return undefined;
  }
  return {
    ...(traceId === undefined ? {} : { traceId: traceId.slice(0, 128) }),
    ...(spanId === undefined ? {} : { spanId: spanId.slice(0, 128) }),
  };
};

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
  const correlationId = asString(redacted.correlationId);
  const statusCode = asStatusCode(redacted.statusCode);
  const trace = safeTrace(redacted.trace, privacy);
  if (
    method === undefined &&
    route === undefined &&
    requestId === undefined &&
    correlationId === undefined &&
    statusCode === undefined &&
    trace === undefined
  ) {
    return undefined;
  }
  return {
    ...(method === undefined ? {} : { method }),
    ...(route === undefined ? {} : { route }),
    ...(requestId === undefined ? {} : { requestId }),
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(trace === undefined ? {} : { trace }),
  };
};

const safeTags = (
  value: unknown,
  privacy: ReturnType<typeof validateConfig>["privacy"],
): WotchiTags | undefined => {
  const redacted = redactValue(value, { ...privacy, maxKeys: Math.min(privacy.maxKeys, 50) });
  if (!isRecord(redacted)) {
    return undefined;
  }
  const tags: Record<string, string> = {};
  for (const [key, tagValue] of Object.entries(redacted)) {
    if (key.length > 64 || typeof tagValue !== "string") {
      continue;
    }
    tags[key] = tagValue.slice(0, 200);
  }
  return Object.keys(tags).length === 0 ? undefined : tags;
};

const safeShortString = (
  value: unknown,
  privacy: ReturnType<typeof validateConfig>["privacy"],
  maxLength: number,
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const redacted = redactValue(value, { ...privacy, maxStringLength: maxLength });
  const text = asString(redacted);
  return text === undefined ? undefined : text.slice(0, maxLength);
};

const safeMessage = (
  value: unknown,
  privacy: ReturnType<typeof validateConfig>["privacy"],
): string => {
  const normalized = normalizeUnknown(value, privacy);
  return typeof normalized === "string" ? normalized : "[unreadable value]";
};

const normalizeEventAlertThreshold = (value: number | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000_000) {
    throw new TypeError("event.alertThreshold must be a positive integer no greater than 1000000");
  }
  return value;
};

const safeErrorFromValue = (
  value: unknown,
  privacy: ReturnType<typeof validateConfig>["privacy"],
): NonNullable<IncidentAlert["error"]> | undefined => {
  const redacted = redactValue(value, privacy);
  if (!isRecord(redacted)) {
    return undefined;
  }
  const name = asString(redacted.name);
  const message = asString(redacted.message);
  if (name === undefined || message === undefined) {
    return undefined;
  }
  const stack = asString(redacted.stack);
  const code = asString(redacted.code);
  const applicationFrame = asString(redacted.applicationFrame);
  return {
    name,
    message,
    ...(stack === undefined ? {} : { stack }),
    ...(code === undefined ? {} : { code }),
    ...(applicationFrame === undefined
      ? {}
      : { applicationFrame: applicationFrame.slice(0, 1_000) }),
  };
};

const safeAlertFromValue = (
  value: unknown,
  fallback: IncidentAlert,
  privacy: ReturnType<typeof validateConfig>["privacy"],
): IncidentAlert | undefined => {
  const redacted = redactValue(value, privacy);
  if (!isRecord(redacted)) {
    return undefined;
  }
  const title = asString(redacted.title);
  const fingerprint = asString(redacted.fingerprint);
  const summary = asString(redacted.summary);
  const severity = asString(redacted.severity);
  const firstSeenAt = asString(redacted.firstSeenAt);
  const lastSeenAt = asString(redacted.lastSeenAt);
  const service = asString(redacted.service);
  const environment = asString(redacted.environment);
  const occurrences = asStatusCode(redacted.occurrences);
  if (
    title === undefined ||
    fingerprint === undefined ||
    summary === undefined ||
    firstSeenAt === undefined ||
    lastSeenAt === undefined ||
    service === undefined ||
    environment === undefined ||
    occurrences === undefined ||
    (severity !== "low" && severity !== "medium" && severity !== "high" && severity !== "critical")
  ) {
    return undefined;
  }
  const rawActions = redacted.suggestedActions;
  if (!Array.isArray(rawActions)) {
    return undefined;
  }
  const suggestedActions = rawActions
    .filter((action): action is string => typeof action === "string")
    .slice(0, 5)
    .map((action) => action.slice(0, 600));
  const error = safeErrorFromValue(redacted.error, privacy);
  const request = safeRequest(redacted.request, privacy);
  const trace = safeTrace(redacted.trace, privacy);
  const context = safeRecord(redacted.context, privacy);
  const tags = safeTags(redacted.tags, privacy);
  const linksValue = safeRecord(redacted.links, privacy);
  const logLink = linksValue === undefined ? undefined : asString(linksValue.log);
  const traceLink = linksValue === undefined ? undefined : asString(linksValue.trace);
  const links = linksValue
    ? {
        ...(logLink === undefined ? {} : { log: logLink.slice(0, 2_048) }),
        ...(traceLink === undefined ? {} : { trace: traceLink.slice(0, 2_048) }),
      }
    : undefined;
  const instance = asString(redacted.instance);
  const release = asString(redacted.release);
  const correlationId = asString(redacted.correlationId);
  const operation = asString(redacted.operation);
  const job = asString(redacted.job);
  return deepFreeze({
    id: asString(redacted.id) ?? fallback.id,
    fingerprint: fingerprint.slice(0, 200),
    title: title.slice(0, 300),
    severity,
    summary: summary.slice(0, 2_000),
    suggestedActions,
    firstSeenAt: firstSeenAt.slice(0, 100),
    lastSeenAt: lastSeenAt.slice(0, 100),
    occurrences: Math.max(0, Math.min(occurrences, Number.MAX_SAFE_INTEGER)),
    service: service.slice(0, 300),
    environment: environment.slice(0, 300),
    ...(instance === undefined ? {} : { instance: instance.slice(0, 200) }),
    ...(release === undefined ? {} : { release: release.slice(0, 200) }),
    ...(correlationId === undefined ? {} : { correlationId: correlationId.slice(0, 200) }),
    ...(operation === undefined ? {} : { operation: operation.slice(0, 200) }),
    ...(job === undefined ? {} : { job: job.slice(0, 200) }),
    ...(tags === undefined ? {} : { tags }),
    ...(error === undefined ? {} : { error }),
    ...(request === undefined ? {} : { request }),
    ...(trace === undefined ? {} : { trace }),
    ...(context === undefined ? {} : { context }),
    ...(links === undefined || Object.keys(links).length === 0 ? {} : { links }),
  });
};

const normalizeFingerprintOverride = (
  override: WotchiFingerprintOverride | undefined,
  event: SafeErrorEvent,
): string | undefined => {
  if (override === undefined) {
    return undefined;
  }
  const value = typeof override === "function" ? override(event) : override;
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) {
    throw new TypeError("fingerprint must be a non-empty string no longer than 200 characters");
  }
  return value.trim();
};

const renderLinks = (
  templates: ReturnType<typeof validateConfig>["links"],
  event: SafeErrorEvent,
  fingerprint: string,
): IncidentAlert["links"] => {
  if (templates === undefined) {
    return undefined;
  }
  const values: Record<string, string> = {
    service: event.service,
    environment: event.environment,
    release: event.release ?? "",
    instance: event.instance ?? "",
    fingerprint,
    requestId: event.request?.requestId ?? "",
    correlationId: event.correlationId ?? event.request?.correlationId ?? "",
    traceId: event.trace?.traceId ?? event.request?.trace?.traceId ?? "",
    spanId: event.trace?.spanId ?? event.request?.trace?.spanId ?? "",
    route: event.request?.route ?? "",
    statusCode: event.request?.statusCode === undefined ? "" : String(event.request.statusCode),
  };
  const render = (template: string): string => {
    const expanded = template.replace(/\{\{([^{}]+)\}\}/g, (_match, key: string) =>
      encodeURIComponent(values[key] ?? ""),
    );
    const redacted = redactValue(expanded, { maxStringLength: 2_048 });
    return typeof redacted === "string" ? redacted.slice(0, 2_048) : "";
  };
  const result: NonNullable<IncidentAlert["links"]> = {};
  if (templates.log !== undefined) {
    result.log = render(templates.log);
  }
  if (templates.trace !== undefined && (values.traceId !== "" || values.spanId !== "")) {
    result.trace = render(templates.trace);
  }
  return Object.keys(result).length === 0 ? undefined : result;
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
    notifierTimeoutMs: normalized.queue.notifierTimeoutMs,
    notifierCircuitBreaker: normalized.queue.notifierCircuitBreaker,
  });
  const admission =
    normalized.overload === undefined
      ? undefined
      : createCaptureAdmission({
          maxEventsPerSecond: normalized.overload.maxEventsPerSecond,
          burst: normalized.overload.burst,
          now,
        });
  const privacy = normalized.privacy;
  let eventSequence = 0;
  let overloadLastAlertAt = 0;

  const matchingRule = (event: SafeErrorEvent) =>
    normalized.rules.find(
      (rule) =>
        (rule.environment === undefined || rule.environment === event.environment) &&
        (rule.route === undefined || rule.route === event.request?.route),
    );

  const captureSafeEvent = (
    error: unknown,
    metadata: unknown,
    context: unknown,
    request: unknown,
    eventKind: IncidentEventKind = "error",
    alertThreshold = normalized.grouping.alertThreshold,
    fingerprintOverride?: WotchiFingerprintOverride,
    severityOverride?: IncidentSeverity,
    trace?: WotchiTraceContext,
    correlationId?: string,
    operation?: string,
    job?: string,
    tags?: Record<string, unknown>,
  ): void => {
    const timestamp = now();
    const safeError = redactError(normalizeError(error, privacy), privacy);
    const requestContext = safeRequest(request, privacy);
    const eventContext = mergeContext(metadata, context, privacy);
    const requestTrace = safeTrace(trace ?? requestContext?.trace, privacy);
    const eventCorrelationId = safeShortString(
      correlationId ?? requestContext?.correlationId,
      privacy,
      200,
    );
    const operationValue = safeShortString(operation ?? eventContext?.operation, privacy, 200);
    const jobValue = safeShortString(job ?? eventContext?.job ?? eventContext?.queue, privacy, 200);
    const eventTags = safeTags(tags, privacy);
    const safeEvent: SafeErrorEvent = {
      id: `event-${eventSequence + 1}`,
      timestamp: new Date(timestamp).toISOString(),
      service: normalized.service,
      environment: normalized.environment,
      ...(normalized.instance === undefined ? {} : { instance: normalized.instance }),
      ...(normalized.release === undefined ? {} : { release: normalized.release }),
      ...(eventCorrelationId === undefined ? {} : { correlationId: eventCorrelationId }),
      ...(operationValue === undefined ? {} : { operation: operationValue.slice(0, 200) }),
      ...(jobValue === undefined ? {} : { job: jobValue.slice(0, 200) }),
      ...(eventTags === undefined ? {} : { tags: eventTags }),
      error: safeError,
      ...(requestContext === undefined ? {} : { request: requestContext }),
      ...(requestTrace === undefined ? {} : { trace: requestTrace }),
      ...(eventContext === undefined ? {} : { context: eventContext }),
    };
    eventSequence += 1;

    const filteredEvent = deepFreeze(safeEvent);
    if (normalized.filter !== undefined) {
      try {
        const accepted = normalized.filter(filteredEvent);
        if (typeof accepted !== "boolean") {
          diagnostics.filterFailures += 1;
          diagnostics.eventsSuppressed += 1;
          return;
        }
        if (!accepted) {
          diagnostics.eventsSuppressed += 1;
          return;
        }
      } catch {
        diagnostics.filterFailures += 1;
        diagnostics.eventsSuppressed += 1;
        return;
      }
    }

    const rule = matchingRule(filteredEvent);
    if (rule?.ignore === true) {
      diagnostics.eventsSuppressed += 1;
      return;
    }
    let fingerprint: string | undefined;
    try {
      fingerprint = normalizeFingerprintOverride(fingerprintOverride, filteredEvent);
    } catch {
      diagnostics.fingerprintCallbackFailures += 1;
    }
    if (fingerprint === undefined && normalized.fingerprint !== undefined) {
      try {
        fingerprint = normalizeFingerprintOverride(normalized.fingerprint, filteredEvent);
      } catch {
        diagnostics.fingerprintCallbackFailures += 1;
      }
    }
    fingerprint ??= fingerprintSafeErrorEvent(filteredEvent);
    const group = groupStore.record(
      fingerprint,
      filteredEvent,
      rule?.severity ?? severityOverride ?? "medium",
    );
    const policyInput = {
      group,
      now: timestamp,
      alertThreshold: rule?.alertThreshold ?? alertThreshold,
      cooldownMs: normalized.grouping.cooldownMs,
      eventKind,
    };
    const manualSeverity = rule?.severity ?? severityOverride;
    const decision =
      manualSeverity === undefined
        ? evaluateIncidentPolicy(policyInput)
        : evaluateIncidentPolicy({ ...policyInput, manualSeverity });
    if (decision.shouldAlert) {
      const builtAlert = buildIncidentAlert(group, decision);
      const links = renderLinks(normalized.links, filteredEvent, fingerprint);
      const alert = deepFreeze({
        ...builtAlert,
        ...(links === undefined ? {} : { links }),
      });
      let finalAlert: IncidentAlert = alert;
      if (normalized.beforeSend !== undefined) {
        let transformed: IncidentAlert | null | undefined;
        try {
          transformed = normalized.beforeSend(alert);
        } catch {
          diagnostics.beforeSendFailures += 1;
          diagnostics.eventsSuppressed += 1;
          return;
        }
        if (transformed === null) {
          diagnostics.eventsSuppressed += 1;
          return;
        }
        if (transformed !== undefined) {
          const sanitized = safeAlertFromValue(transformed, alert, privacy);
          if (sanitized === undefined) {
            diagnostics.beforeSendFailures += 1;
            diagnostics.eventsSuppressed += 1;
            return;
          }
          finalAlert = sanitized;
        }
      }
      if (queue.enqueue(finalAlert, normalized.notifiers)) {
        groupStore.markAlerted(fingerprint, timestamp);
      }
    }
    diagnostics.capturedEvents += 1;
  };

  const emitOverloadSignal = (timestamp: number): void => {
    const cooldownMs = normalized.overload?.alertCooldownMs ?? 0;
    if (cooldownMs > 0 && timestamp - overloadLastAlertAt < cooldownMs) {
      return;
    }
    overloadLastAlertAt = timestamp;
    captureSafeEvent(
      new Error("Wotchi capture overload: admission limit reached"),
      undefined,
      { droppedEvents: diagnostics.eventsDroppedOverload },
      undefined,
      "runtime-monitor",
      1,
      "wotchi.capture.overload",
      "high",
      undefined,
      undefined,
      "wotchi.overload",
      undefined,
      undefined,
    );
  };

  const captureException = (
    error: unknown,
    context?: Record<string, unknown>,
    options?: WotchiCaptureOptions,
  ): void => {
    if (!normalized.enabled) {
      return;
    }
    if (queue.isClosed()) {
      diagnostics.capturesAfterShutdown += 1;
      return;
    }
    try {
      if (admission !== undefined && !admission.tryAcquire()) {
        diagnostics.eventsDroppedOverload += 1;
        emitOverloadSignal(now());
        return;
      }
      captureSafeEvent(
        error,
        undefined,
        context,
        options?.request,
        "error",
        normalizeEventAlertThreshold(options?.alertThreshold) ?? normalized.grouping.alertThreshold,
        options?.fingerprint,
        options?.severity,
        options?.trace,
        options?.correlationId,
        options?.operation,
        options?.job,
        options?.tags,
      );
    } catch {
      diagnostics.captureFailures += 1;
    }
  };

  const captureEvent = (event: WotchiEventInput): void => {
    if (!normalized.enabled) {
      return;
    }
    if (queue.isClosed()) {
      diagnostics.capturesAfterShutdown += 1;
      return;
    }
    try {
      if (event === null || typeof event !== "object" || event.level !== "error") {
        throw new TypeError("event.level must be error");
      }
      if (typeof event.message !== "string") {
        throw new TypeError("event.message must be a string");
      }
      const alertThreshold = normalizeEventAlertThreshold(event.alertThreshold);
      if (
        admission !== undefined &&
        event.kind !== "process-monitor" &&
        event.kind !== "runtime-monitor" &&
        !admission.tryAcquire()
      ) {
        diagnostics.eventsDroppedOverload += 1;
        emitOverloadSignal(now());
        return;
      }
      captureSafeEvent(
        event.error ?? safeMessage(event.message, privacy),
        event.metadata,
        event.context,
        event.request,
        event.kind ?? "error",
        alertThreshold ?? normalized.grouping.alertThreshold,
        event.fingerprint,
        event.severity,
        event.trace,
        event.correlationId,
        event.operation,
        event.job,
        event.tags,
      );
    } catch {
      diagnostics.captureFailures += 1;
    }
  };

  const readDiagnostics = (): Readonly<WotchiDiagnostics> =>
    snapshotDiagnostics(diagnostics, {
      groupsEvicted: groupStore.groupsEvicted(),
      alertsQueued: queue.alertsQueued(),
      alertsDropped: queue.alertsDropped(),
      alertsSent: queue.alertsSent(),
      notifierFailures: queue.notifierFailures(),
      notifierTimeouts: queue.notifierTimeouts(),
      notifierCircuitOpenSkips: queue.notifierCircuitOpenSkips(),
      activeGroups: groupStore.size(),
      pendingAlerts: queue.pending(),
    });

  const testAlert = async (): Promise<WotchiTestAlertResult> => {
    const timestamp = new Date(now()).toISOString();
    const alert: IncidentAlert = {
      id: `wotchi-test-${timestamp}`,
      fingerprint: "wotchi-test-alert",
      title: "Wotchi — Test alert",
      severity: "low",
      summary: "This is a notifier configuration test alert.",
      suggestedActions: ["Confirm this destination received the test alert."],
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      occurrences: 1,
      service: normalized.service,
      environment: normalized.environment,
      ...(normalized.instance === undefined ? {} : { instance: normalized.instance }),
      ...(normalized.release === undefined ? {} : { release: normalized.release }),
    };
    let jobResult: { notifierFailures: number } | undefined;
    if (
      !queue.enqueue(alert, normalized.notifiers, (result) => {
        jobResult = result;
      })
    ) {
      return {
        status: "queue-full",
        configurationAccepted: true,
        queued: false,
        flushed: false,
        delivered: false,
        notifierFailures: 0,
        diagnostics: readDiagnostics(),
        error: "Notification queue is full; test alert was not queued.",
      };
    }
    try {
      await queue.flush();
    } catch {
      return {
        status: "timeout",
        configurationAccepted: true,
        queued: true,
        flushed: false,
        delivered: false,
        notifierFailures: jobResult?.notifierFailures ?? 0,
        diagnostics: readDiagnostics(),
        error: "Notification queue flush timed out.",
      };
    }
    const notifierFailures = jobResult?.notifierFailures ?? 0;
    const status = notifierFailures > 0 ? "notifier-failed" : "sent";
    return {
      status,
      configurationAccepted: true,
      queued: true,
      flushed: true,
      delivered: status === "sent",
      notifierFailures,
      diagnostics: readDiagnostics(),
      ...(status === "notifier-failed" ? { error: "One or more notifiers failed." } : {}),
    };
  };

  const shutdown = async (timeoutMs?: number): Promise<void> => {
    await queue.close(timeoutMs);
  };

  return {
    captureException,
    captureEvent,
    testAlert,
    flush: (timeoutMs?: number) => queue.flush(timeoutMs),
    shutdown,
    getDiagnostics: readDiagnostics,
  };
}
