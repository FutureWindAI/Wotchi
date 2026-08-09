export interface NormalizationLimits {
  maxDepth: number;
  maxKeys: number;
  maxStringLength: number;
  maxStackLength: number;
}

export type SafeNormalizedValue =
  null | boolean | number | string | SafeNormalizedValue[] | { [key: string]: SafeNormalizedValue };

export interface NormalizedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

const UNREADABLE_VALUE = "[unreadable value]";
const MAX_DEPTH_VALUE = "[MaxDepth]";
const CIRCULAR_VALUE = "[Circular]";
const MAX_KEYS_VALUE = "[MaxKeys]";
const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const defaultLimits: NormalizationLimits = {
  maxDepth: 5,
  maxKeys: 100,
  maxStringLength: 500,
  maxStackLength: 4_000,
};

interface TraversalState {
  readonly seen: WeakSet<object>;
  keysVisited: number;
}

const boundedLimit = (value: number, fallback: number, maximum: number): number =>
  Number.isSafeInteger(value) && value > 0 && value <= maximum ? value : fallback;

const normalizeLimits = (limits?: Partial<NormalizationLimits>): NormalizationLimits => ({
  maxDepth: boundedLimit(
    limits?.maxDepth ?? defaultLimits.maxDepth,
    defaultLimits.maxDepth,
    MAX_NORMALIZATION_DEPTH,
  ),
  maxKeys: boundedLimit(
    limits?.maxKeys ?? defaultLimits.maxKeys,
    defaultLimits.maxKeys,
    MAX_NORMALIZATION_KEYS,
  ),
  maxStringLength: boundedLimit(
    limits?.maxStringLength ?? defaultLimits.maxStringLength,
    defaultLimits.maxStringLength,
    MAX_NORMALIZATION_STRING_LENGTH,
  ),
  maxStackLength: boundedLimit(
    limits?.maxStackLength ?? defaultLimits.maxStackLength,
    defaultLimits.maxStackLength,
    MAX_NORMALIZATION_STACK_LENGTH,
  ),
});

const truncate = (value: string, limit: number): string => value.slice(0, limit);

const readProperty = (value: object, key: string): unknown => {
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return UNREADABLE_VALUE;
  }
};

const normalizePrimitive = (value: unknown, limits: NormalizationLimits): SafeNormalizedValue => {
  if (value === null) {
    return null;
  }
  switch (typeof value) {
    case "string":
      return truncate(value, limits.maxStringLength);
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : "[non-finite number]";
    case "undefined":
      return "[undefined]";
    case "bigint":
      return "[bigint]";
    case "symbol":
      return "[symbol]";
    case "function":
      return "[function]";
    default:
      return UNREADABLE_VALUE;
  }
};

const normalizeValue = (
  value: unknown,
  depth: number,
  state: TraversalState,
  limits: NormalizationLimits,
): SafeNormalizedValue => {
  if (value === null || typeof value !== "object") {
    return normalizePrimitive(value, limits);
  }
  if (depth >= limits.maxDepth) {
    return MAX_DEPTH_VALUE;
  }
  if (state.seen.has(value)) {
    return CIRCULAR_VALUE;
  }
  state.seen.add(value);

  if (Array.isArray(value)) {
    const result: SafeNormalizedValue[] = [];
    let length: number;
    try {
      length = Math.min(value.length, limits.maxKeys - state.keysVisited);
    } catch {
      return UNREADABLE_VALUE;
    }
    for (let index = 0; index < length; index += 1) {
      if (state.keysVisited >= limits.maxKeys) {
        break;
      }
      state.keysVisited += 1;
      result.push(normalizeValue(readProperty(value, String(index)), depth + 1, state, limits));
    }
    return result;
  }

  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    return UNREADABLE_VALUE;
  }

  const result: { [key: string]: SafeNormalizedValue } = {};
  for (const key of keys) {
    if (UNSAFE_OBJECT_KEYS.has(key)) {
      continue;
    }
    if (state.keysVisited >= limits.maxKeys - 1) {
      result["[truncated]"] = MAX_KEYS_VALUE;
      break;
    }
    state.keysVisited += 1;
    result[truncate(key, limits.maxStringLength)] = normalizeValue(
      readProperty(value, key),
      depth + 1,
      state,
      limits,
    );
  }
  return result;
};

export function normalizeUnknown(
  value: unknown,
  limits?: Partial<NormalizationLimits>,
): SafeNormalizedValue {
  const normalizedLimits = normalizeLimits(limits);
  try {
    return normalizeValue(
      value,
      0,
      { seen: new WeakSet<object>(), keysVisited: 0 },
      normalizedLimits,
    );
  } catch {
    return UNREADABLE_VALUE;
  }
}

const safeStringProperty = (
  value: object,
  key: string,
  fallback: string,
  limit: number,
): string => {
  const property = readProperty(value, key);
  return typeof property === "string" ? truncate(property, limit) : fallback;
};

export function normalizeError(
  error: unknown,
  limits?: Partial<NormalizationLimits>,
): NormalizedError {
  const normalizedLimits = normalizeLimits(limits);
  let isError: boolean;
  try {
    isError = error instanceof Error;
  } catch {
    isError = false;
  }

  if (isError && error !== null && typeof error === "object") {
    const name = safeStringProperty(error, "name", "Error", normalizedLimits.maxStringLength);
    const message = safeStringProperty(
      error,
      "message",
      UNREADABLE_VALUE,
      normalizedLimits.maxStringLength,
    );
    const stack = safeStringProperty(error, "stack", "", normalizedLimits.maxStackLength);
    const code = safeStringProperty(error, "code", "", normalizedLimits.maxStringLength);
    return {
      name: name || "Error",
      message,
      ...(stack ? { stack } : {}),
      ...(code ? { code } : {}),
    };
  }

  const normalized = normalizeUnknown(error, normalizedLimits);
  const message = typeof normalized === "string" ? normalized : UNREADABLE_VALUE;
  return { name: "UnknownError", message };
}
import {
  MAX_NORMALIZATION_DEPTH,
  MAX_NORMALIZATION_KEYS,
  MAX_NORMALIZATION_STACK_LENGTH,
  MAX_NORMALIZATION_STRING_LENGTH,
} from "./limits.js";
