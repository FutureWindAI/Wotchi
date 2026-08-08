import type { RequestHandler } from "express";
import type { WotchiClient } from "../../core/types.js";
import { getExpressRequestContext } from "./request-context.js";
import type { RequestContextOptions } from "../request-context.js";
import { wasExpressErrorCaptured } from "./state.js";

export type WotchiStatusClass = "4xx" | "5xx";

export interface WotchiStatusObserverOptions extends RequestContextOptions {
  statusCodes?: readonly number[];
  statusClasses?: readonly WotchiStatusClass[];
  ignoreStatusCodes?: readonly number[];
  alertThreshold?: number;
}

interface NormalizedStatusObserverOptions extends RequestContextOptions {
  readonly statusCodes: ReadonlySet<number>;
  readonly statusClasses: ReadonlySet<WotchiStatusClass>;
  readonly ignoreStatusCodes: ReadonlySet<number>;
  readonly alertThreshold?: number;
}

const DEFAULT_STATUS_CODES = [401, 403, 429] as const;
const DEFAULT_STATUS_CLASSES = ["5xx"] as const;
const MAX_STATUS_CODES = 100;

const normalizeStatuses = (
  values: readonly number[] | undefined,
  defaults: readonly number[],
): ReadonlySet<number> => {
  const selected = values ?? defaults;
  if (selected.length > MAX_STATUS_CODES) {
    throw new TypeError("statusCodes must contain at most 100 values");
  }
  for (const status of selected) {
    if (!Number.isSafeInteger(status) || status < 100 || status > 599) {
      throw new TypeError("statusCodes must contain HTTP status codes from 100 through 599");
    }
  }
  return new Set(selected);
};

const normalizeStatusClasses = (
  values: readonly WotchiStatusClass[] | undefined,
): ReadonlySet<WotchiStatusClass> => {
  const selected = values ?? DEFAULT_STATUS_CLASSES;
  for (const statusClass of selected) {
    if (statusClass !== "4xx" && statusClass !== "5xx") {
      throw new TypeError('statusClasses must contain only "4xx" or "5xx"');
    }
  }
  return new Set(selected);
};

const normalizeAlertThreshold = (value: number | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000_000) {
    throw new TypeError("alertThreshold must be a positive integer no greater than 1000000");
  }
  return value;
};

const normalizeOptions = (
  options?: WotchiStatusObserverOptions,
): NormalizedStatusObserverOptions => {
  const alertThreshold = normalizeAlertThreshold(options?.alertThreshold);
  return {
    ...(options?.requestIdProperty === undefined
      ? {}
      : { requestIdProperty: options.requestIdProperty }),
    statusCodes: normalizeStatuses(options?.statusCodes, DEFAULT_STATUS_CODES),
    statusClasses: normalizeStatusClasses(options?.statusClasses),
    ignoreStatusCodes: normalizeStatuses(options?.ignoreStatusCodes, []),
    ...(alertThreshold === undefined ? {} : { alertThreshold }),
  };
};

const isObservedStatus = (statusCode: number, options: NormalizedStatusObserverOptions): boolean =>
  !options.ignoreStatusCodes.has(statusCode) &&
  (options.statusCodes.has(statusCode) ||
    (statusCode >= 400 && statusCode < 500 && options.statusClasses.has("4xx")) ||
    (statusCode >= 500 && statusCode < 600 && options.statusClasses.has("5xx")));

export function wotchiStatusObserver(
  client: WotchiClient,
  options?: WotchiStatusObserverOptions,
): RequestHandler {
  const normalizedOptions = normalizeOptions(options);
  return (request, response, next): void => {
    response.once("finish", () => {
      const statusCode = response.statusCode;
      if (wasExpressErrorCaptured(request) || !isObservedStatus(statusCode, normalizedOptions)) {
        return;
      }
      try {
        const requestContext = getExpressRequestContext(request, response, normalizedOptions);
        client.captureEvent({
          level: "error",
          message: `HTTP ${statusCode} response`,
          ...(normalizedOptions.alertThreshold === undefined
            ? {}
            : { alertThreshold: normalizedOptions.alertThreshold }),
          ...(requestContext === undefined ? {} : { request: requestContext }),
        });
      } catch {
        // Status observation must never change the host response lifecycle.
      }
    });
    next();
  };
}
