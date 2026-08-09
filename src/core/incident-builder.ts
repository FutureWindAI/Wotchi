import type { IncidentAlert, IncidentGroup, IncidentSeverity } from "./types.js";
import type { IncidentPolicyDecision } from "./incident-policy.js";
import { selectApplicationFrame } from "./stack-frame.js";

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
  const applicationFrame = selectApplicationFrame(group.sample.error.stack);
  const error: NonNullable<IncidentAlert["error"]> = {
    ...group.sample.error,
    ...(applicationFrame === undefined ? {} : { applicationFrame }),
  };
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
    ...(group.sample.instance === undefined ? {} : { instance: group.sample.instance }),
    ...(group.sample.release === undefined ? {} : { release: group.sample.release }),
    ...(group.sample.correlationId === undefined
      ? {}
      : { correlationId: group.sample.correlationId }),
    ...(group.sample.operation === undefined ? {} : { operation: group.sample.operation }),
    ...(group.sample.job === undefined ? {} : { job: group.sample.job }),
    ...(group.sample.tags === undefined ? {} : { tags: group.sample.tags }),
    error,
    ...(group.sample.request === undefined ? {} : { request: group.sample.request }),
    ...(group.sample.trace === undefined ? {} : { trace: group.sample.trace }),
    ...(group.sample.context === undefined ? {} : { context: group.sample.context }),
  };
}
