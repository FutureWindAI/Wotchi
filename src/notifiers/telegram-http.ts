import https from "node:https";
import type { RequestOptions } from "node:https";

const DEFAULT_TIMEOUT_MS = 3_000;
const MAX_RESPONSE_BYTES = 8_192;
const MAX_RETRY_DELAY_MS = 1_000;

export interface TelegramHttpRequestOptions extends RequestOptions {
  protocol: "https:";
  hostname: "api.telegram.org";
  method: "POST";
  path: string;
  headers: Record<string, string | number>;
}

export interface TelegramHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export type TelegramRequestFunction = (
  options: TelegramHttpRequestOptions,
  body: string,
  timeoutMs: number,
) => Promise<TelegramHttpResponse>;

export interface TelegramSendOptions {
  botToken: string;
  chatId: string;
  text: string;
  timeoutMs?: number;
}

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const failRequest = (): never => {
  throw new Error("Telegram request failed");
};

const parseRetryAfter = (body: string): number => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) {
      return 0;
    }
    const parameters = (parsed as { parameters?: unknown }).parameters;
    if (typeof parameters !== "object" || parameters === null) {
      return 0;
    }
    const retryAfter = (parameters as { retry_after?: unknown }).retry_after;
    return typeof retryAfter === "number" && Number.isSafeInteger(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1_000, MAX_RETRY_DELAY_MS)
      : 0;
  } catch {
    return 0;
  }
};

const isSuccessResponse = (response: TelegramHttpResponse): boolean => {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(response.body);
    return (
      typeof parsed === "object" && parsed !== null && (parsed as { ok?: unknown }).ok === true
    );
  } catch {
    return false;
  }
};

const createRequestOptions = (botToken: string): TelegramHttpRequestOptions => ({
  protocol: "https:",
  hostname: "api.telegram.org",
  method: "POST",
  path: `/bot${botToken}/sendMessage`,
  headers: {},
});

const httpsRequest: TelegramRequestFunction = (options, body, timeoutMs) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      callback();
    };
    const request = https.request(options, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer | string) => {
        size += Buffer.byteLength(chunk);
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy();
          finish(() => reject(new Error("Telegram response body exceeded limit")));
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
    request.once("error", (error: unknown) => finish(() => reject(error)));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      finish(() => reject(new Error("Telegram request timed out")));
    });
    request.end(body);
  });

const requestWithTimeout = async (
  request: TelegramRequestFunction,
  options: TelegramHttpRequestOptions,
  body: string,
  timeoutMs: number,
): Promise<TelegramHttpResponse> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Telegram request timed out")), timeoutMs);
    });
    return await Promise.race([request(options, body, timeoutMs), timeout]);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Telegram request timed out") {
      throw error;
    }
    if (error instanceof Error && error.message === "Telegram response body exceeded limit") {
      throw error;
    }
    return failRequest();
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

export async function sendTelegramMessage(
  options: TelegramSendOptions,
  request: TelegramRequestFunction = httpsRequest,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) {
    throw new TypeError("timeoutMs is invalid");
  }
  const body = JSON.stringify({
    chat_id: options.chatId,
    text: options.text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  const requestOptions = createRequestOptions(options.botToken);
  requestOptions.headers = {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body, "utf8"),
  };
  let rateLimitRetries = 0;
  let serverRetries = 0;

  while (true) {
    const response = await requestWithTimeout(request, requestOptions, body, timeoutMs);
    if (Buffer.byteLength(response.body, "utf8") > MAX_RESPONSE_BYTES) {
      throw new Error("Telegram response body exceeded limit");
    }
    if (isSuccessResponse(response)) {
      return;
    }
    if (response.statusCode === 429 && rateLimitRetries === 0) {
      rateLimitRetries += 1;
      await wait(parseRetryAfter(response.body));
      continue;
    }
    if (response.statusCode >= 500 && response.statusCode <= 599 && serverRetries === 0) {
      serverRetries += 1;
      continue;
    }
    throw new Error(`Telegram API request failed with status ${response.statusCode}`);
  }
}
