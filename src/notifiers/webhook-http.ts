import http from "node:http";
import https from "node:https";
import type { IncidentAlert, WebhookNotifierOptions } from "../core/types.js";
import { toBoundedAlertPayload, toBoundedPayload } from "./alert-payload.js";

const DEFAULT_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 8_192;
const MAX_PAYLOAD_BYTES = 32_768;
const MAX_URL_LENGTH = 2_048;
const MAX_HEADER_COUNT = 20;
const MAX_HEADER_VALUE_LENGTH = 2_000;

export interface WebhookRequestOptions {
  protocol: "http:" | "https:";
  hostname: string;
  port?: string;
  method: "POST";
  path: string;
  headers: Record<string, string | number>;
  signal?: AbortSignal;
}

export interface WebhookResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export type WebhookRequestFunction = (
  options: WebhookRequestOptions,
  body: string,
  timeoutMs: number,
) => Promise<WebhookResponse>;

export interface WebhookSendOptions {
  url: string;
  alert: IncidentAlert;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  allowHttpLoopback?: boolean;
  payloadBuilder?: (alert: Readonly<IncidentAlert>) => unknown;
}

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const normalizeUrl = (value: string, allowHttpLoopback = false): URL => {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_URL_LENGTH) {
    throw new TypeError("webhook url is invalid");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("webhook url is invalid");
  }
  if (url.username !== "" || url.password !== "" || url.hash !== "") {
    throw new TypeError("webhook url must not contain credentials or a fragment");
  }
  if (url.protocol === "https:") {
    return url;
  }
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (url.protocol !== "http:" || !allowHttpLoopback || !loopback.has(url.hostname)) {
    throw new TypeError("webhook url must be HTTPS or explicitly enabled loopback HTTP");
  }
  return url;
};

const normalizeHeaders = (
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined => {
  if (headers === undefined) {
    return undefined;
  }
  const entries = Object.entries(headers);
  if (entries.length > MAX_HEADER_COUNT) {
    throw new TypeError("webhook headers exceed the maximum count");
  }
  const normalized: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (!/^[A-Za-z0-9-]+$/.test(name) || name.length > 100) {
      throw new TypeError("webhook header name is invalid");
    }
    if (
      typeof value !== "string" ||
      value.length > MAX_HEADER_VALUE_LENGTH ||
      /[\r\n]/.test(value)
    ) {
      throw new TypeError("webhook header value is invalid");
    }
    const normalizedName = name.toLowerCase();
    if (normalizedName === "content-length" || normalizedName === "host") {
      throw new TypeError(`webhook header ${normalizedName} is reserved`);
    }
    normalized[normalizedName] = value;
  }
  return normalized;
};

export function normalizeWebhookOptions(options: WebhookNotifierOptions): {
  url: URL;
  headers?: Record<string, string>;
  timeoutMs: number;
  maxRetries: number;
  allowHttpLoopback: boolean;
  payloadBuilder?: WebhookNotifierOptions["payloadBuilder"];
} {
  if (options.allowHttpLoopback !== undefined && typeof options.allowHttpLoopback !== "boolean") {
    throw new TypeError("webhook allowHttpLoopback is invalid");
  }
  const allowHttpLoopback = options.allowHttpLoopback === true;
  const url = normalizeUrl(options.url, allowHttpLoopback);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new TypeError("webhook timeoutMs is invalid");
  }
  const maxRetries = options.maxRetries ?? 1;
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0 || maxRetries > 1) {
    throw new TypeError("webhook maxRetries must be 0 or 1");
  }
  if (options.payloadBuilder !== undefined && typeof options.payloadBuilder !== "function") {
    throw new TypeError("webhook payloadBuilder is invalid");
  }
  const headers = normalizeHeaders(options.headers);
  return {
    url,
    ...(headers === undefined ? {} : { headers }),
    timeoutMs,
    maxRetries,
    allowHttpLoopback,
    ...(options.payloadBuilder === undefined ? {} : { payloadBuilder: options.payloadBuilder }),
  };
}

const defaultRequest: WebhookRequestFunction = (options, body, timeoutMs) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let removeAbortListener = (): void => undefined;
    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      removeAbortListener();
      callback();
    };
    const request = (options.protocol === "http:" ? http : https).request(options, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer | string) => {
        size += Buffer.byteLength(chunk);
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy();
          finish(() => reject(new Error("webhook response body exceeded limit")));
          return;
        }
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.once("error", (error: unknown) => finish(() => reject(error)));
      response.once("end", () =>
        finish(() =>
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        ),
      );
    });
    const onAbort = (): void => {
      request.destroy();
    };
    if (options.signal !== undefined) {
      options.signal.addEventListener("abort", onAbort, { once: true });
      removeAbortListener = () => options.signal?.removeEventListener("abort", onAbort);
      if (options.signal.aborted) {
        onAbort();
      }
    }
    request.once("error", (error: unknown) => finish(() => reject(error)));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      finish(() => reject(new Error("webhook request timed out")));
    });
    request.end(body);
  });

const requestWithTimeout = async (
  request: WebhookRequestFunction,
  options: WebhookRequestOptions,
  body: string,
  timeoutMs: number,
): Promise<WebhookResponse> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("webhook request timed out"));
      }, timeoutMs);
    });
    return await Promise.race([
      request({ ...options, signal: controller.signal }, body, timeoutMs),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
};

const serializeAlert = (
  alert: IncidentAlert,
  payloadBuilder: WebhookNotifierOptions["payloadBuilder"],
): string => {
  const sanitizedAlert = deepFreeze(toBoundedAlertPayload(alert) as unknown as IncidentAlert);
  let payload: Record<string, unknown>;
  try {
    const custom = payloadBuilder === undefined ? sanitizedAlert : payloadBuilder(sanitizedAlert);
    payload = toBoundedPayload(custom);
  } catch {
    throw new Error("webhook payload builder failed");
  }
  const envelope = {
    version: 1,
    type: "incident.alert",
    sentAt: new Date().toISOString(),
    alert: payload,
  };
  const serialized = JSON.stringify(envelope);
  if (Buffer.byteLength(serialized, "utf8") <= MAX_PAYLOAD_BYTES) {
    return serialized;
  }
  const fallback = JSON.stringify({
    version: 1,
    type: "incident.alert",
    sentAt: new Date().toISOString(),
    alert: {
      title: alert.title.slice(0, 300),
      fingerprint: alert.fingerprint.slice(0, 200),
      severity: alert.severity,
      summary: alert.summary.slice(0, 2_000),
      service: alert.service.slice(0, 200),
      environment: alert.environment.slice(0, 200),
      occurrences: alert.occurrences,
      truncated: true,
    },
  });
  return fallback;
};

export async function sendWebhookAlert(
  options: WebhookSendOptions,
  request: WebhookRequestFunction = defaultRequest,
): Promise<void> {
  const normalized = normalizeWebhookOptions(options);
  const body = serializeAlert(options.alert, normalized.payloadBuilder);
  const requestOptions: WebhookRequestOptions = {
    protocol: normalized.url.protocol as "http:" | "https:",
    hostname: normalized.url.hostname.replace(/^\[|\]$/g, ""),
    ...(normalized.url.port === "" ? {} : { port: normalized.url.port }),
    method: "POST",
    path: `${normalized.url.pathname || "/"}${normalized.url.search}`,
    headers: {
      ...(normalized.headers ?? {}),
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body, "utf8"),
    },
  };
  let attempt = 0;
  while (true) {
    const response = await requestWithTimeout(request, requestOptions, body, normalized.timeoutMs);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }
    if (
      attempt < normalized.maxRetries &&
      (response.statusCode === 429 || response.statusCode >= 500)
    ) {
      attempt += 1;
      await wait(50);
      continue;
    }
    throw new Error(`Webhook request failed with status ${response.statusCode}`);
  }
}
