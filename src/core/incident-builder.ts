import type { IncidentAlert, IncidentGroup, IncidentSeverity } from "./types.js";
import type { IncidentPolicyDecision } from "./incident-policy.js";

const titleCase = (value: IncidentSeverity): string =>
  `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;

const suggestedActions = (group: IncidentGroup): string[] => {
  const text = `${group.sample.error.name} ${group.sample.error.message}`.toLowerCase();
  if (text.includes("database") || text.includes("query") || text.includes("sql")) {
    return [
      "Check database availability, connection saturation, and recent schema changes.",
      "Check the affected query and its dependency health before increasing capacity.",
    ];
  }
  if (text.includes("timeout") || text.includes("timed out")) {
    return [
      "Check upstream latency, timeout settings, and recent dependency changes.",
      "Check whether retries or a dependency outage are increasing request pressure.",
    ];
  }
  if (text.includes("auth") || text.includes("permission") || text.includes("unauthor")) {
    return [
      "Check authentication configuration, credentials, and recent access-policy changes.",
      "Check whether the affected route is receiving an unexpected caller or token.",
    ];
  }
  return [
    "Check the application logs and the selected stack frame for the first failing operation.",
    "Check recent deployments, dependency health, and the affected request path.",
  ];
};

export function buildIncidentAlert(
  group: IncidentGroup,
  decision: IncidentPolicyDecision,
): IncidentAlert {
  const message = group.sample.error.message;
  const errorName = group.sample.error.name;
  return {
    id: `wotchi-${group.fingerprint}-${group.lastSeenAt}`,
    fingerprint: group.fingerprint,
    title: `Wotchi — ${titleCase(decision.severity)} incident`,
    severity: decision.severity,
    summary: `Observed ${group.windowCount} occurrences of ${errorName}: ${message}.`,
    suggestedActions: suggestedActions(group),
    firstSeenAt: group.firstSeenAt,
    lastSeenAt: group.lastSeenAt,
    occurrences: group.windowCount,
    service: group.sample.service,
    environment: group.sample.environment,
  };
}
