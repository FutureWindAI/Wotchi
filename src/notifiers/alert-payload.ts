import { redactValue } from "../core/redact.js";
import type { SafeNormalizedValue } from "../core/normalize.js";
import type { IncidentAlert } from "../core/types.js";

const isRecord = (value: SafeNormalizedValue): value is { [key: string]: SafeNormalizedValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type BoundedAlertPayload = Record<string, SafeNormalizedValue>;

export function toBoundedPayload(value: unknown): BoundedAlertPayload {
  const redacted = redactValue(value, {
    maxDepth: 6,
    maxKeys: 100,
    maxStringLength: 1_000,
    maxStackLength: 4_000,
  });
  return isRecord(redacted)
    ? redacted
    : { title: "Wotchi alert", summary: "Incident details were unavailable." };
}

export function toBoundedAlertPayload(alert: IncidentAlert): BoundedAlertPayload {
  return toBoundedPayload(alert);
}
