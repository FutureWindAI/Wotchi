import type { IncidentAlert } from "../core/types.js";
import { redactValue } from "../core/redact.js";

const MAX_MESSAGE_LENGTH = 4_096;
const MAX_ACTIONS = 5;
const MAX_TITLE_LENGTH = 300;
const MAX_SERVICE_LENGTH = 300;
const MAX_ENVIRONMENT_LENGTH = 300;
const MAX_SUMMARY_LENGTH = 2_000;
const MAX_ACTION_LENGTH = 600;
const MAX_DETAIL_LENGTH = 900;

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const limit = (value: string, maxLength: number): string => value.slice(0, maxLength);

const safeText = (value: string, maxLength: number): string => {
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

const details = (alert: IncidentAlert): string[] => {
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
    lines.push(`Tags: ${safeText(safeJson(alert.tags), MAX_DETAIL_LENGTH)}`);
  }
  if (alert.error !== undefined) {
    lines.push(`Error: ${safeText(alert.error.name, 250)} — ${safeText(alert.error.message, 500)}`);
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
    const redacted = redactValue(alert.context, { maxDepth: 4, maxKeys: 40, maxStringLength: 300 });
    lines.push(`Context: ${safeText(safeJson(redacted), MAX_DETAIL_LENGTH)}`);
  }
  if (alert.links !== undefined) {
    lines.push(`Links: ${safeText(safeJson(alert.links), MAX_DETAIL_LENGTH)}`);
  }
  return lines.map((line) => limit(line, MAX_DETAIL_LENGTH));
};

const render = (
  title: string,
  service: string,
  environment: string,
  summary: string,
  actions: readonly string[],
  context: readonly string[],
  firstSeenAt: string,
  lastSeenAt: string,
  occurrences: number,
): string => {
  const actionText =
    actions.length === 0
      ? "- No suggested checks."
      : actions.map((action) => `- ${escapeHtml(action)}`).join("\n");
  return [
    `<b>${escapeHtml(title)}</b>`,
    `Service: ${escapeHtml(service)}`,
    `Environment: ${escapeHtml(environment)}`,
    `Summary: ${escapeHtml(summary)}`,
    `Occurrences: ${occurrences}`,
    `First seen: ${escapeHtml(firstSeenAt)}`,
    `Last seen: ${escapeHtml(lastSeenAt)}`,
    ...context.map((line) => escapeHtml(line)),
    "Suggested checks:",
    actionText,
  ].join("\n");
};

export function formatTelegramAlert(alert: IncidentAlert): string {
  const title = limit(alert.title, MAX_TITLE_LENGTH);
  const service = limit(alert.service, MAX_SERVICE_LENGTH);
  const environment = limit(alert.environment, MAX_ENVIRONMENT_LENGTH);
  const firstSeenAt = limit(alert.firstSeenAt, 100);
  const lastSeenAt = limit(alert.lastSeenAt, 100);
  let summary = limit(alert.summary, MAX_SUMMARY_LENGTH);
  let actions = alert.suggestedActions
    .slice(0, MAX_ACTIONS)
    .map((action) => limit(action, MAX_ACTION_LENGTH));
  const context = details(alert);
  let formatted = render(
    title,
    service,
    environment,
    summary,
    actions,
    context,
    firstSeenAt,
    lastSeenAt,
    alert.occurrences,
  );

  while (formatted.length > MAX_MESSAGE_LENGTH && actions.length > 0) {
    actions = actions.slice(0, -1);
    formatted = render(
      title,
      service,
      environment,
      summary,
      actions,
      context,
      firstSeenAt,
      lastSeenAt,
      alert.occurrences,
    );
  }
  while (formatted.length > MAX_MESSAGE_LENGTH && summary.length > 0) {
    summary = summary.slice(0, Math.max(0, summary.length - 200));
    formatted = render(
      title,
      service,
      environment,
      summary,
      actions,
      context,
      firstSeenAt,
      lastSeenAt,
      alert.occurrences,
    );
  }
  if (formatted.length > MAX_MESSAGE_LENGTH) {
    formatted = render(
      limit(title, 100),
      limit(service, 100),
      limit(environment, 100),
      "Incident details were truncated.",
      [],
      [],
      firstSeenAt,
      lastSeenAt,
      alert.occurrences,
    );
  }
  return formatted;
}
