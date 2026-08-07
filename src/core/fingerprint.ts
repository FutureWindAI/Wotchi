import { createHash } from "node:crypto";
import { redactValue } from "./redact.js";
import { selectApplicationFrame } from "./stack-frame.js";
import type { SafeErrorEvent } from "./types.js";

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const HEX_PATTERN = /\b(?:0x)?[0-9a-f]{8,}\b/gi;
const NUMBER_PATTERN = /\b\d+\b/g;

export function normalizeDynamicSegments(value: string): string {
  return value
    .replace(UUID_PATTERN, "<uuid>")
    .replace(HEX_PATTERN, "<hex>")
    .replace(NUMBER_PATTERN, "<number>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const safeText = (value: unknown): string => {
  const redacted = redactValue(value, { maxStringLength: 4_000 });
  return typeof redacted === "string" ? redacted : "[unreadable value]";
};

const encodePart = (value: string): string => `${value.length}:${value}`;

export function fingerprintSafeErrorEvent(event: SafeErrorEvent): string {
  const service = normalizeDynamicSegments(safeText(event.service));
  const environment = normalizeDynamicSegments(safeText(event.environment));
  const errorName = normalizeDynamicSegments(safeText(event.error.name));
  const message = normalizeDynamicSegments(safeText(event.error.message));
  const method = normalizeDynamicSegments(safeText(event.request?.method ?? ""));
  const route = normalizeDynamicSegments(safeText(event.request?.route ?? ""));
  const frame = normalizeDynamicSegments(selectApplicationFrame(event.error.stack) ?? "");
  const canonical = [service, environment, errorName, message, method, route, frame]
    .map(encodePart)
    .join("|");

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
