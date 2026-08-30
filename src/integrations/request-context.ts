import type { WotchiRequestContext, WotchiTraceContext } from "../core/types.js";

export interface RequestContextOptions {
  requestIdProperty?: string;
  correlationIdProperty?: string;
  traceContextProperty?: string;
}

const MAX_ROUTE_LENGTH = 500;
const MAX_REQUEST_ID_LENGTH = 200;
const MAX_CORRELATION_ID_LENGTH = 200;
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

const normalizePropertyName = (
  property: string | undefined,
  optionName: keyof RequestContextOptions,
): string | undefined => {
  if (property === undefined) {
    return undefined;
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(property)) {
    throw new TypeError(`${optionName} must be a simple property name`);
  }
  return property;
};

export function normalizeRequestContextOptions(
  options?: RequestContextOptions,
): Readonly<RequestContextOptions> {
  const requestIdProperty = normalizePropertyName(options?.requestIdProperty, "requestIdProperty");
  const correlationIdProperty = normalizePropertyName(
    options?.correlationIdProperty,
    "correlationIdProperty",
  );
  const traceContextProperty = normalizePropertyName(
    options?.traceContextProperty,
    "traceContextProperty",
  );
  return Object.freeze({
    ...(requestIdProperty === undefined ? {} : { requestIdProperty }),
    ...(correlationIdProperty === undefined ? {} : { correlationIdProperty }),
    ...(traceContextProperty === undefined ? {} : { traceContextProperty }),
  });
}

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

const readTraceContext = (
  request: unknown,
  property: string | undefined,
): WotchiTraceContext | undefined => {
  if (property === undefined || !isRecord(request)) {
    return undefined;
  }
  try {
    if (!Object.prototype.hasOwnProperty.call(request, property)) {
      return undefined;
    }
    const value = request[property];
    if (!isRecord(value)) {
      return undefined;
    }
    const traceId = typeof value.traceId === "string" ? value.traceId.slice(0, 128) : undefined;
    const spanId = typeof value.spanId === "string" ? value.spanId.slice(0, 128) : undefined;
    if (traceId === undefined && spanId === undefined) {
      return undefined;
    }
    return {
      ...(traceId === undefined ? {} : { traceId }),
      ...(spanId === undefined ? {} : { spanId }),
    };
  } catch {
    return undefined;
  }
};

const readCorrelationId = (request: unknown, property: string | undefined): string | undefined => {
  if (property === undefined || !isRecord(request)) {
    return undefined;
  }
  try {
    if (!Object.prototype.hasOwnProperty.call(request, property)) {
      return undefined;
    }
    const value = request[property];
    return typeof value === "string" ? value.slice(0, MAX_CORRELATION_ID_LENGTH) : undefined;
  } catch {
    return undefined;
  }
};

export interface RequestContextInput {
  request?: unknown;
  method?: unknown;
  route?: unknown;
  statusCode?: unknown;
  trace?: unknown;
  options?: RequestContextOptions;
}

export function buildRequestContext(input: RequestContextInput): WotchiRequestContext | undefined {
  const options = normalizeRequestContextOptions(input.options);
  const { requestIdProperty, correlationIdProperty, traceContextProperty } = options;
  let requestId: string | undefined;
  try {
    requestId = readRequestId(input.request, requestIdProperty);
  } catch {
    requestId = undefined;
  }
  let correlationId: string | undefined;
  try {
    correlationId = readCorrelationId(input.request, correlationIdProperty);
  } catch {
    correlationId = undefined;
  }
  let trace: WotchiTraceContext | undefined;
  try {
    const explicitTrace = input.trace;
    trace = readTraceContext({ trace: explicitTrace }, "trace");
    trace ??= readTraceContext(input.request, traceContextProperty);
  } catch {
    trace = undefined;
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
    requestId === undefined &&
    correlationId === undefined &&
    trace === undefined
  ) {
    return undefined;
  }
  return {
    ...(method === undefined ? {} : { method }),
    ...(route === undefined ? {} : { route }),
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(requestId === undefined ? {} : { requestId }),
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(trace === undefined ? {} : { trace }),
  };
}
