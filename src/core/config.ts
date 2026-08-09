import type {
  IncidentSeverity,
  WotchiConfig,
  WotchiIncidentRule,
  WotchiLinkTemplates,
  WotchiNotifier,
} from "./types.js";
import { WotchiConfigurationError } from "./errors.js";
import {
  MAX_ALERT_THRESHOLD,
  MAX_COOLDOWN_MS,
  MAX_EVENTS_PER_WINDOW,
  MAX_GROUPS,
  MAX_NORMALIZATION_DEPTH,
  MAX_NORMALIZATION_KEYS,
  MAX_NORMALIZATION_STACK_LENGTH,
  MAX_NORMALIZATION_STRING_LENGTH,
  MAX_PENDING_ALERTS,
  MAX_WINDOW_MS,
} from "./limits.js";

export { WotchiConfigurationError };

const MAX_REDACT_KEYS = 100;
const MAX_RULES = 50;
const MAX_RULE_STRING_LENGTH = 200;
const MAX_LINK_TEMPLATE_LENGTH = 1_000;
const ALLOWED_LINK_PLACEHOLDERS = new Set([
  "service",
  "environment",
  "release",
  "instance",
  "fingerprint",
  "requestId",
  "correlationId",
  "traceId",
  "spanId",
  "route",
  "statusCode",
]);

export interface NormalizedWotchiConfig {
  readonly service: string;
  readonly environment: string;
  readonly instance?: string;
  readonly release?: string;
  readonly enabled: boolean;
  readonly filter?: WotchiConfig["filter"];
  readonly fingerprint?: WotchiConfig["fingerprint"];
  readonly beforeSend?: WotchiConfig["beforeSend"];
  readonly links?: Readonly<WotchiLinkTemplates>;
  readonly rules: readonly WotchiIncidentRule[];
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
  maximum: number,
): number => {
  const value = parent?.[field];
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > maximum) {
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

const normalizeRuleString = (value: unknown, field: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(field);
  }
  return value.trim().slice(0, MAX_RULE_STRING_LENGTH);
};

const normalizeSeverity = (value: unknown, field: string): IncidentSeverity | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value !== "low" && value !== "medium" && value !== "high" && value !== "critical") {
    return fail(field);
  }
  return value;
};

const freezeHook = <T extends (...args: never[]) => unknown>(hook: T): T => {
  try {
    return Object.freeze(hook);
  } catch {
    return hook;
  }
};

const normalizeLinks = (value: unknown): Readonly<WotchiLinkTemplates> | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return fail("links");
  }
  const normalized: WotchiLinkTemplates = {};
  for (const key of ["log", "trace"] as const) {
    const raw = value[key];
    if (raw === undefined) {
      continue;
    }
    if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LINK_TEMPLATE_LENGTH) {
      return fail(`links.${key}`);
    }
    let parsed: URL;
    try {
      parsed = new URL(raw.replace(/\{\{[^{}]+\}\}/g, "placeholder"));
    } catch {
      return fail(`links.${key}`);
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hash !== ""
    ) {
      return fail(`links.${key}`);
    }
    const placeholders = raw.match(/\{\{([^{}]+)\}\}/g) ?? [];
    if (/[{}]/.test(raw.replace(/\{\{[^{}]+\}\}/g, ""))) {
      return fail(`links.${key}`);
    }
    for (const placeholder of placeholders) {
      const name = placeholder.slice(2, -2);
      if (!ALLOWED_LINK_PLACEHOLDERS.has(name)) {
        return fail(`links.${key}`);
      }
    }
    normalized[key] = raw;
  }
  return Object.freeze(normalized);
};

const normalizeRules = (value: unknown): readonly WotchiIncidentRule[] => {
  if (value === undefined) {
    return Object.freeze([]);
  }
  if (!Array.isArray(value) || value.length > MAX_RULES) {
    return fail("rules");
  }
  const rules = value.map((rawRule, index) => {
    if (!isRecord(rawRule)) {
      return fail(`rules[${index}]`);
    }
    const alertThreshold = rawRule.alertThreshold;
    if (
      alertThreshold !== undefined &&
      (typeof alertThreshold !== "number" ||
        !Number.isSafeInteger(alertThreshold) ||
        alertThreshold <= 0 ||
        alertThreshold > 1_000_000)
    ) {
      return fail(`rules[${index}].alertThreshold`);
    }
    if (rawRule.ignore !== undefined && typeof rawRule.ignore !== "boolean") {
      return fail(`rules[${index}].ignore`);
    }
    const environment = normalizeRuleString(rawRule.environment, `rules[${index}].environment`);
    const route = normalizeRuleString(rawRule.route, `rules[${index}].route`);
    const severity = normalizeSeverity(rawRule.severity, `rules[${index}].severity`);
    const rule: WotchiIncidentRule = {};
    if (environment !== undefined) {
      rule.environment = environment;
    }
    if (route !== undefined) {
      rule.route = route;
    }
    if (rawRule.ignore !== undefined) {
      rule.ignore = rawRule.ignore;
    }
    if (alertThreshold !== undefined) {
      rule.alertThreshold = alertThreshold;
    }
    if (severity !== undefined) {
      rule.severity = severity;
    }
    return Object.freeze(rule);
  });
  return Object.freeze(rules);
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
    const valid = (() => {
      try {
        return (
          isRecord(notifier) &&
          typeof notifier.name === "string" &&
          notifier.name.trim().length > 0 &&
          typeof notifier.send === "function"
        );
      } catch {
        return false;
      }
    })();
    if (!valid) {
      return fail("notifiers[" + index + "]");
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
  if (
    config.instance !== undefined &&
    (typeof config.instance !== "string" || config.instance.trim().length === 0)
  ) {
    return fail("instance");
  }
  if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
    return fail("enabled");
  }
  if (config.filter !== undefined && typeof config.filter !== "function") {
    return fail("filter");
  }
  if (config.fingerprint !== undefined && typeof config.fingerprint !== "function") {
    return fail("fingerprint");
  }
  if (config.beforeSend !== undefined && typeof config.beforeSend !== "function") {
    return fail("beforeSend");
  }

  const grouping = readOptionalRecord(config.grouping, "grouping");
  const queue = readOptionalRecord(config.queue, "queue");
  const privacy = readOptionalRecord(config.privacy, "privacy");
  const links = normalizeLinks(config.links);
  const concurrency = queue?.concurrency;
  if (concurrency !== undefined && concurrency !== 1) {
    return fail("queue.concurrency");
  }

  const normalized: NormalizedWotchiConfig = {
    service: service.trim(),
    environment: environment.trim(),
    ...(config.instance === undefined ? {} : { instance: config.instance.trim().slice(0, 200) }),
    ...(config.release === undefined ? {} : { release: config.release.trim().slice(0, 200) }),
    enabled: config.enabled ?? true,
    ...(config.filter === undefined ? {} : { filter: freezeHook(config.filter) }),
    ...(config.fingerprint === undefined ? {} : { fingerprint: freezeHook(config.fingerprint) }),
    ...(config.beforeSend === undefined ? {} : { beforeSend: freezeHook(config.beforeSend) }),
    ...(links === undefined ? {} : { links }),
    rules: normalizeRules(config.rules),
    grouping: Object.freeze({
      windowMs: readPositiveInteger(grouping, "windowMs", 60_000, MAX_WINDOW_MS),
      alertThreshold: readPositiveInteger(grouping, "alertThreshold", 3, MAX_ALERT_THRESHOLD),
      cooldownMs: readPositiveInteger(grouping, "cooldownMs", 900_000, MAX_COOLDOWN_MS),
      maxGroups: readPositiveInteger(grouping, "maxGroups", 200, MAX_GROUPS),
      maxEventsPerWindow: readPositiveInteger(
        grouping,
        "maxEventsPerWindow",
        100,
        MAX_EVENTS_PER_WINDOW,
      ),
    }),
    queue: Object.freeze({
      maxPendingAlerts: readPositiveInteger(queue, "maxPendingAlerts", 100, MAX_PENDING_ALERTS),
      concurrency: 1,
    }),
    privacy: Object.freeze({
      redactKeys: normalizeRedactKeys(privacy),
      maxDepth: readPositiveInteger(privacy, "maxDepth", 5, MAX_NORMALIZATION_DEPTH),
      maxKeys: readPositiveInteger(privacy, "maxKeys", 100, MAX_NORMALIZATION_KEYS),
      maxStringLength: readPositiveInteger(
        privacy,
        "maxStringLength",
        500,
        MAX_NORMALIZATION_STRING_LENGTH,
      ),
      maxStackLength: readPositiveInteger(
        privacy,
        "maxStackLength",
        4_000,
        MAX_NORMALIZATION_STACK_LENGTH,
      ),
    }),
    notifiers: normalizeNotifiers(config.notifiers),
  };

  return Object.freeze(normalized);
}
