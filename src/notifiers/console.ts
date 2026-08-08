import type { ConsoleNotifierOptions, IncidentAlert, WotchiNotifier } from "../core/types.js";
import { redactValue } from "../core/redact.js";

const MAX_FIELD_LENGTH = 1_000;
const MAX_ACTIONS = 5;

const limit = (value: string, maxLength = MAX_FIELD_LENGTH): string => value.slice(0, maxLength);

const safeText = (value: string, maxLength = MAX_FIELD_LENGTH): string => {
  const redacted = redactValue(value, { maxStringLength: maxLength });
  return typeof redacted === "string" ? limit(redacted, maxLength) : "[unreadable value]";
};

const boundedAlert = (
  alert: IncidentAlert,
): {
  title: string;
  fingerprint: string;
  severity: IncidentAlert["severity"];
  summary: string;
  suggestedActions: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  service: string;
  environment: string;
} => ({
  title: safeText(alert.title),
  fingerprint: safeText(alert.fingerprint),
  severity: alert.severity,
  summary: safeText(alert.summary),
  suggestedActions: alert.suggestedActions
    .slice(0, MAX_ACTIONS)
    .map((action) => safeText(action, 300)),
  firstSeenAt: safeText(alert.firstSeenAt, 100),
  lastSeenAt: safeText(alert.lastSeenAt, 100),
  occurrences:
    Number.isSafeInteger(alert.occurrences) && alert.occurrences >= 0 ? alert.occurrences : 0,
  service: safeText(alert.service, 300),
  environment: safeText(alert.environment, 300),
});

export function formatConsoleAlert(alert: IncidentAlert, format: "text" | "json" = "text"): string {
  const bounded = boundedAlert(alert);
  if (format === "json") {
    return JSON.stringify(bounded);
  }
  const actions = bounded.suggestedActions.map((action) => `- ${action}`).join("\n");
  return [
    bounded.title,
    `Service: ${bounded.service}`,
    `Environment: ${bounded.environment}`,
    `Summary: ${bounded.summary}`,
    `Occurrences: ${bounded.occurrences}`,
    `First seen: ${bounded.firstSeenAt}`,
    `Last seen: ${bounded.lastSeenAt}`,
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
