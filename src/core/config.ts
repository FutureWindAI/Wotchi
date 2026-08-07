import type { WotchiConfig, WotchiNotifier } from "./types.js";
import { WotchiConfigurationError } from "./errors.js";

export { WotchiConfigurationError };

const MAX_REDACT_KEYS = 100;

export interface NormalizedWotchiConfig {
  readonly service: string;
  readonly environment: string;
  readonly release?: string;
  readonly enabled: boolean;
  readonly grouping: {
    readonly windowMs: number;
    readonly alertThreshold: number;
    readonly cooldownMs: number;
    readonly maxGroups: number;
    readonly maxEventsPerWindow: number;
  };
  readonly queue: {
    readonly maxPendingAlerts: number;
    readonly concurrency: 1;
  };
  readonly privacy: {
    readonly redactKeys: readonly string[];
    readonly maxDepth: number;
    readonly maxKeys: number;
    readonly maxStringLength: number;
    readonly maxStackLength: number;
  };
  readonly notifiers: readonly WotchiNotifier[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const fail = (field: string): never => {
  throw new WotchiConfigurationError(`${field} is invalid`);
};

const readPositiveInteger = (
  parent: Record<string, unknown> | undefined,
  field: string,
  defaultValue: number,
): number => {
  const value = parent?.[field];
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return fail(field);
  }
  return value;
};

const readOptionalRecord = (value: unknown, field: string): Record<string, unknown> | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return fail(field);
  }
  return value;
};

const normalizeRedactKeys = (privacy: Record<string, unknown> | undefined): readonly string[] => {
  const value = privacy?.redactKeys;
  if (value === undefined) {
    return Object.freeze([]);
  }
  if (!Array.isArray(value) || value.length > MAX_REDACT_KEYS) {
    return fail("privacy.redactKeys");
  }

  const keys = value.map((key, index) => {
    if (typeof key !== "string" || key.trim().length === 0) {
      return fail(`privacy.redactKeys[${index}]`);
    }
    return key.trim();
  });

  return Object.freeze([...new Set(keys)]);
};

const normalizeNotifiers = (value: unknown): readonly WotchiNotifier[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return fail("notifiers");
  }
  for (let index = 0; index < value.length; index += 1) {
    const notifier = value[index];
    if (
      !isRecord(notifier) ||
      typeof notifier.name !== "string" ||
      notifier.name.trim().length === 0 ||
      typeof notifier.send !== "function"
    ) {
      return fail(`notifiers[${index}]`);
    }
  }
  return Object.freeze([...value] as WotchiNotifier[]);
};

export function validateConfig(config: WotchiConfig): Readonly<NormalizedWotchiConfig> {
  if (!isRecord(config)) {
    return fail("config");
  }

  const service = config.service;
  if (typeof service !== "string" || service.trim().length === 0) {
    return fail("service");
  }
  const environment = config.environment;
  if (typeof environment !== "string" || environment.trim().length === 0) {
    return fail("environment");
  }
  if (
    config.release !== undefined &&
    (typeof config.release !== "string" || config.release.trim().length === 0)
  ) {
    return fail("release");
  }
  if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
    return fail("enabled");
  }

  const grouping = readOptionalRecord(config.grouping, "grouping");
  const queue = readOptionalRecord(config.queue, "queue");
  const privacy = readOptionalRecord(config.privacy, "privacy");
  const concurrency = queue?.concurrency;
  if (concurrency !== undefined && concurrency !== 1) {
    return fail("queue.concurrency");
  }

  const normalized: NormalizedWotchiConfig = {
    service: service.trim(),
    environment: environment.trim(),
    ...(config.release === undefined ? {} : { release: config.release.trim() }),
    enabled: config.enabled ?? true,
    grouping: Object.freeze({
      windowMs: readPositiveInteger(grouping, "windowMs", 60_000),
      alertThreshold: readPositiveInteger(grouping, "alertThreshold", 3),
      cooldownMs: readPositiveInteger(grouping, "cooldownMs", 900_000),
      maxGroups: readPositiveInteger(grouping, "maxGroups", 200),
      maxEventsPerWindow: readPositiveInteger(grouping, "maxEventsPerWindow", 100),
    }),
    queue: Object.freeze({
      maxPendingAlerts: readPositiveInteger(queue, "maxPendingAlerts", 100),
      concurrency: 1,
    }),
    privacy: Object.freeze({
      redactKeys: normalizeRedactKeys(privacy),
      maxDepth: readPositiveInteger(privacy, "maxDepth", 5),
      maxKeys: readPositiveInteger(privacy, "maxKeys", 100),
      maxStringLength: readPositiveInteger(privacy, "maxStringLength", 500),
      maxStackLength: readPositiveInteger(privacy, "maxStackLength", 4_000),
    }),
    notifiers: normalizeNotifiers(config.notifiers),
  };

  return Object.freeze(normalized);
}
