import { normalizeUnknown } from "./normalize.js";
import type { NormalizedError, SafeNormalizedValue } from "./normalize.js";

export const REDACTED = "[REDACTED]";

export interface RedactionOptions {
  redactKeys?: readonly string[];
  maxDepth?: number;
  maxKeys?: number;
  maxStringLength?: number;
  maxStackLength?: number;
}

const DEFAULT_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwd",
  "secret",
  "apiKey",
  "api_key",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "privateKey",
  "private_key",
  "clientSecret",
  "client_secret",
  "cardNumber",
  "cvv",
  "cvc",
  "pin",
] as const;

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[-_]/g, "");

const defaultKeySet = new Set(DEFAULT_KEYS.map(normalizeKey));

const isRecord = (value: SafeNormalizedValue): value is { [key: string]: SafeNormalizedValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const luhnValid = (digits: string): boolean => {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
};

const redactCardLikeValues = (value: string): string =>
  value.replace(/\b\d[\d -]{11,25}\d\b/g, (candidate) => {
    const digits = candidate.replace(/[ -]/g, "");
    return digits.length >= 13 && digits.length <= 19 && luhnValid(digits) ? REDACTED : candidate;
  });

const redactString = (value: string, maxStringLength: number): string => {
  let result = value;
  result = result.replace(
    /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
    REDACTED,
  );
  result = result.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`);
  result = result.replace(
    /\b(?:authorization|password|passwd|secret|token|api[-_]?key)\s*[:=]\s*[^\s,;]+/gi,
    (match) => `${match.slice(0, match.search(/[:=]/))}: ${REDACTED}`,
  );
  result = result.replace(
    /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    REDACTED,
  );
  result = result.replace(
    /\b(?:github_pat|ghp|xox[baprs]-|sk|pk|AKIA)[A-Za-z0-9_-]{8,}\b/gi,
    REDACTED,
  );
  result = redactCardLikeValues(result);
  return result.slice(0, maxStringLength);
};

const normalizedOption = (value: number | undefined, fallback: number): number =>
  Number.isSafeInteger(value) && value !== undefined && value > 0 ? value : fallback;

const redactNormalized = (
  value: SafeNormalizedValue,
  sensitiveKeys: ReadonlySet<string>,
  options: Required<
    Pick<RedactionOptions, "maxDepth" | "maxKeys" | "maxStringLength" | "maxStackLength">
  >,
  depth: number,
  keysVisited: { value: number },
): SafeNormalizedValue => {
  if (typeof value === "string") {
    return redactString(value, options.maxStringLength);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (depth >= options.maxDepth) {
    return "[MaxDepth]";
  }

  if (Array.isArray(value)) {
    const result: SafeNormalizedValue[] = [];
    for (const item of value) {
      if (keysVisited.value >= options.maxKeys) {
        break;
      }
      keysVisited.value += 1;
      result.push(redactNormalized(item, sensitiveKeys, options, depth + 1, keysVisited));
    }
    return result;
  }

  const result: { [key: string]: SafeNormalizedValue } = {};
  for (const [key, child] of Object.entries(value)) {
    if (keysVisited.value >= options.maxKeys) {
      break;
    }
    keysVisited.value += 1;
    const normalizedKey = normalizeKey(key);
    result[key] = sensitiveKeys.has(normalizedKey)
      ? REDACTED
      : typeof child === "string" && normalizedKey === "stack"
        ? redactString(child, options.maxStackLength)
        : redactNormalized(child, sensitiveKeys, options, depth + 1, keysVisited);
  }
  return result;
};

const redactionLimits = (
  options: RedactionOptions,
): Required<
  Pick<RedactionOptions, "maxDepth" | "maxKeys" | "maxStringLength" | "maxStackLength">
> => ({
  maxDepth: normalizedOption(options.maxDepth, 5),
  maxKeys: normalizedOption(options.maxKeys, 100),
  maxStringLength: normalizedOption(options.maxStringLength, 500),
  maxStackLength: normalizedOption(options.maxStackLength, 4_000),
});

const sensitiveKeySet = (options: RedactionOptions): ReadonlySet<string> => {
  const keys = new Set(defaultKeySet);
  for (const key of options.redactKeys ?? []) {
    if (typeof key === "string" && key.trim().length > 0) {
      keys.add(normalizeKey(key.trim()));
    }
  }
  return keys;
};

export function redactValue(value: unknown, options: RedactionOptions = {}): SafeNormalizedValue {
  const limits = redactionLimits(options);
  const normalized = normalizeUnknown(value, {
    maxDepth: limits.maxDepth,
    maxKeys: limits.maxKeys,
    maxStringLength: limits.maxStringLength,
    maxStackLength: limits.maxStackLength,
  });
  return redactNormalized(normalized, sensitiveKeySet(options), limits, 0, { value: 0 });
}

export function redactError(
  error: NormalizedError,
  options: RedactionOptions = {},
): NormalizedError {
  const redacted = redactValue(error, options);
  if (!isRecord(redacted)) {
    return { name: "UnknownError", message: REDACTED };
  }
  const name = typeof redacted.name === "string" ? redacted.name : "UnknownError";
  const message = typeof redacted.message === "string" ? redacted.message : REDACTED;
  const stack = typeof redacted.stack === "string" ? redacted.stack : undefined;
  const code = typeof redacted.code === "string" ? redacted.code : undefined;
  return {
    name,
    message,
    ...(stack === undefined ? {} : { stack }),
    ...(code === undefined ? {} : { code }),
  };
}
