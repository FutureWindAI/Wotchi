import type { IncidentAlert } from "../core/types.js";

const MAX_MESSAGE_LENGTH = 4_096;
const MAX_ACTIONS = 5;
const MAX_TITLE_LENGTH = 300;
const MAX_SERVICE_LENGTH = 300;
const MAX_ENVIRONMENT_LENGTH = 300;
const MAX_SUMMARY_LENGTH = 2_000;
const MAX_ACTION_LENGTH = 600;

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const limit = (value: string, maxLength: number): string => value.slice(0, maxLength);

const render = (
  title: string,
  service: string,
  environment: string,
  summary: string,
  actions: readonly string[],
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
  let formatted = render(
    title,
    service,
    environment,
    summary,
    actions,
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
      firstSeenAt,
      lastSeenAt,
      alert.occurrences,
    );
  }
  return formatted;
}
