import type { IncidentGroup, IncidentSeverity } from "./types.js";

export type IncidentEventKind = "error" | "manual" | "process-monitor";

export interface IncidentPolicyInput {
  group: IncidentGroup;
  now: number;
  alertThreshold: number;
  cooldownMs: number;
  eventKind?: IncidentEventKind;
  manualSeverity?: IncidentSeverity;
}

export interface IncidentPolicyDecision {
  shouldAlert: boolean;
  severity: IncidentSeverity;
}

const hasCooldown = (group: IncidentGroup, now: number, cooldownMs: number): boolean => {
  if (group.lastAlertedAt === undefined) {
    return false;
  }
  const lastAlerted = Date.parse(group.lastAlertedAt);
  return Number.isFinite(lastAlerted) && now - lastAlerted < cooldownMs;
};

const hasUnavailableResponse = (group: IncidentGroup): boolean =>
  group.sample.request?.statusCode === 503;

export function evaluateIncidentPolicy(input: IncidentPolicyInput): IncidentPolicyDecision {
  const eventKind = input.eventKind ?? "error";
  const isCritical = eventKind === "process-monitor";
  const isHigh = input.group.windowCount >= 20 || hasUnavailableResponse(input.group);
  const severity: IncidentSeverity =
    input.manualSeverity ??
    (isCritical ? "critical" : isHigh ? "high" : eventKind === "manual" ? "low" : "medium");
  const eligible =
    isCritical ||
    isHigh ||
    eventKind === "manual" ||
    input.group.windowCount >= input.alertThreshold;

  return {
    shouldAlert: eligible && !hasCooldown(input.group, input.now, input.cooldownMs),
    severity,
  };
}
