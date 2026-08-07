import type { WotchiRequestContext } from "../core/types.js";

export interface RequestContextOptions {
  requestIdProperty?: string;
}

const MAX_ROUTE_LENGTH = 500;
const MAX_REQUEST_ID_LENGTH = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_PATTERN = /^[0-9a-f]{8,}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const dynamicSegment = (segment: string): string =>
  /^\d+$/.test(segment) ||
  UUID_PATTERN.test(segment) ||
  HEX_PATTERN.test(segment) ||
  segment.length >= 24
    ? ":id"
    : segment;

export function normalizeRoutePath(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const path = value.split("?", 1)[0]?.trim();
  if (path === undefined || path.length === 0) {
    return undefined;
  }
  return path.split("/").map(dynamicSegment).join("/").slice(0, MAX_ROUTE_LENGTH);
}

const normalizeRequestIdProperty = (property: string | undefined): string | undefined => {
  if (property === undefined) {
    return undefined;
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(property)) {
    throw new TypeError("requestIdProperty must be a simple property name");
  }
  return property;
};

const readRequestId = (request: unknown, property: string | undefined): string | undefined => {
  if (property === undefined || !isRecord(request)) {
    return undefined;
  }
  try {
    if (!Object.prototype.hasOwnProperty.call(request, property)) {
      return undefined;
    }
    const value = request[property];
    return typeof value === "string" ? value.slice(0, MAX_REQUEST_ID_LENGTH) : undefined;
  } catch {
    return undefined;
  }
};

export interface RequestContextInput {
  request?: unknown;
  method?: unknown;
  route?: unknown;
  statusCode?: unknown;
  options?: RequestContextOptions;
}

export function buildRequestContext(input: RequestContextInput): WotchiRequestContext | undefined {
  const requestIdProperty = normalizeRequestIdProperty(input.options?.requestIdProperty);
  let requestId: string | undefined;
  try {
    requestId = readRequestId(input.request, requestIdProperty);
  } catch {
    requestId = undefined;
  }
  const method = typeof input.method === "string" ? input.method.slice(0, 16) : undefined;
  const route = normalizeRoutePath(input.route);
  const statusCode =
    typeof input.statusCode === "number" && Number.isSafeInteger(input.statusCode)
      ? input.statusCode
      : undefined;
  if (
    method === undefined &&
    route === undefined &&
    statusCode === undefined &&
    requestId === undefined
  ) {
    return undefined;
  }
  return {
    ...(method === undefined ? {} : { method }),
    ...(route === undefined ? {} : { route }),
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(requestId === undefined ? {} : { requestId }),
  };
}
