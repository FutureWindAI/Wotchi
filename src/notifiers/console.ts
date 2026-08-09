import type { ConsoleNotifierOptions, IncidentAlert, WotchiNotifier } from "../core/types.js";
import { redactValue } from "../core/redact.js";
import { toBoundedAlertPayload } from "./alert-payload.js";

const MAX_FIELD_LENGTH = 1_000;
const MAX_ACTIONS = 5;

const limit = (value: string, maxLength = MAX_FIELD_LENGTH): string => value.slice(0, maxLength);

const safeText = (value: string, maxLength = MAX_FIELD_LENGTH): string => {
  const redacted = redactValue(value, { maxStringLength: maxLength });
  return typeof redacted === "string" ? limit(redacted, maxLength) : "[unreadable value]";
};

const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unreadable value]";
  }
};

const boundedAlert = (alert: IncidentAlert): Record<string, unknown> => {
  const payload = toBoundedAlertPayload(alert);
  return {
    ...payload,
    title: safeText(typeof payload.title === "string" ? payload.title : alert.title),
    fingerprint: safeText(
      typeof payload.fingerprint === "string" ? payload.fingerprint : alert.fingerprint,
    ),
    severity: alert.severity,
    summary: safeText(typeof payload.summary === "string" ? payload.summary : alert.summary),
    suggestedActions: alert.suggestedActions
      .slice(0, MAX_ACTIONS)
      .map((action) => safeText(action, 300)),
    firstSeenAt: safeText(alert.firstSeenAt, 100),
    lastSeenAt: safeText(alert.lastSeenAt, 100),
    occurrences:
      Number.isSafeInteger(alert.occurrences) && alert.occurrences >= 0 ? alert.occurrences : 0,
    service: safeText(alert.service, 300),
    environment: safeText(alert.environment, 300),
  };
};

const textDetails = (alert: IncidentAlert): string[] => {
  const lines: string[] = [];
  if (alert.release !== undefined) {
    lines.push(`Release: ${safeText(alert.release, 200)}`);
  }
  if (alert.instance !== undefined) {
    lines.push(`Instance: ${safeText(alert.instance, 200)}`);
  }
  if (alert.operation !== undefined) {
    lines.push(`Operation: ${safeText(alert.operation, 200)}`);
  }
  if (alert.job !== undefined) {
    lines.push(`Job: ${safeText(alert.job, 200)}`);
  }
  if (alert.correlationId !== undefined) {
    lines.push(`Correlation ID: ${safeText(alert.correlationId, 200)}`);
  }
  if (alert.tags !== undefined) {
    lines.push(`Tags: ${safeText(safeJson(alert.tags), 600)}`);
  }
  if (alert.error !== undefined) {
    lines.push(`Error: ${safeText(alert.error.name, 300)} — ${safeText(alert.error.message, 600)}`);
    if (alert.error.applicationFrame !== undefined) {
      lines.push(`Application frame: ${safeText(alert.error.applicationFrame, 500)}`);
    }
  }
  if (alert.request !== undefined) {
    const request = [alert.request.method, alert.request.route].filter(
      (value): value is string => typeof value === "string",
    );
    if (alert.request.statusCode !== undefined) {
      request.push(`status ${alert.request.statusCode}`);
    }
    if (request.length > 0) {
      lines.push(`Request: ${request.join(" ")}`);
    }
    if (alert.request.requestId !== undefined) {
      lines.push(`Request ID: ${safeText(alert.request.requestId, 200)}`);
    }
    if (alert.request.correlationId !== undefined) {
      lines.push(`Correlation ID: ${safeText(alert.request.correlationId, 200)}`);
    }
  }
  const trace = alert.trace ?? alert.request?.trace;
  if (trace?.traceId !== undefined || trace?.spanId !== undefined) {
    lines.push(
      `Trace: ${safeText(trace.traceId ?? "", 128)}${trace.spanId === undefined ? "" : ` span ${safeText(trace.spanId, 128)}`}`,
    );
  }
  if (alert.context !== undefined) {
    lines.push(`Context: ${safeText(safeJson(alert.context), 1_000)}`);
  }
  if (alert.links !== undefined) {
    lines.push(`Links: ${safeText(safeJson(alert.links), 600)}`);
  }
  return lines;
};

export function formatConsoleAlert(alert: IncidentAlert, format: "text" | "json" = "text"): string {
  const bounded = boundedAlert(alert);
  if (format === "json") {
    return JSON.stringify(bounded);
  }
  const actions = alert.suggestedActions
    .slice(0, MAX_ACTIONS)
    .map((action) => `- ${safeText(action, 300)}`)
    .join("\n");
  return [
    bounded.title,
    `Service: ${bounded.service}`,
    `Environment: ${bounded.environment}`,
    `Summary: ${bounded.summary}`,
    `Occurrences: ${bounded.occurrences}`,
    `First seen: ${bounded.firstSeenAt}`,
    `Last seen: ${bounded.lastSeenAt}`,
    ...textDetails(alert),
    "Suggested checks:",
    actions,
  ].join("\n");
}

export function consoleNotifier(options?: ConsoleNotifierOptions): WotchiNotifier {
  const write = options?.write ?? ((line: string) => console.error(line));
  return {
    name: "console",
    async send(alert): Promise<void> {
      write(formatConsoleAlert(alert, options?.format ?? "text"));
    },
  };
}
