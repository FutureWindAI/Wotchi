import type { ConsoleNotifierOptions, IncidentAlert, WotchiNotifier } from "../core/types.js";

const MAX_FIELD_LENGTH = 1_000;
const MAX_ACTIONS = 5;

const limit = (value: string, maxLength = MAX_FIELD_LENGTH): string => value.slice(0, maxLength);

export function formatConsoleAlert(alert: IncidentAlert): string {
  const actions = alert.suggestedActions
    .slice(0, MAX_ACTIONS)
    .map((action) => `- ${limit(action, 300)}`)
    .join("\n");
  return [
    limit(alert.title),
    `Service: ${limit(alert.service, 300)}`,
    `Environment: ${limit(alert.environment, 300)}`,
    `Summary: ${limit(alert.summary)}`,
    `Occurrences: ${alert.occurrences}`,
    `First seen: ${limit(alert.firstSeenAt, 100)}`,
    `Last seen: ${limit(alert.lastSeenAt, 100)}`,
    "Suggested checks:",
    actions,
  ].join("\n");
}

export function consoleNotifier(options?: ConsoleNotifierOptions): WotchiNotifier {
  const write = options?.write ?? ((line: string) => console.error(line));
  return {
    name: "console",
    async send(alert): Promise<void> {
      write(formatConsoleAlert(alert));
    },
  };
}
