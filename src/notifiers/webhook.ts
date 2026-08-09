import type { WebhookNotifierOptions, WotchiNotifier } from "../core/types.js";
import {
  normalizeWebhookOptions,
  sendWebhookAlert,
  type WebhookRequestFunction,
} from "./webhook-http.js";

export function createWebhookNotifier(
  options: WebhookNotifierOptions,
  request?: WebhookRequestFunction,
): WotchiNotifier {
  const normalized = normalizeWebhookOptions(options);
  const sendOptions = {
    url: normalized.url.toString(),
    ...(normalized.headers === undefined ? {} : { headers: normalized.headers }),
    timeoutMs: normalized.timeoutMs,
    maxRetries: normalized.maxRetries,
    allowHttpLoopback: normalized.allowHttpLoopback,
    ...(normalized.payloadBuilder === undefined
      ? {}
      : { payloadBuilder: normalized.payloadBuilder }),
  };
  return {
    name: "webhook",
    async send(alert): Promise<void> {
      await sendWebhookAlert({ ...sendOptions, alert }, request);
    },
  };
}

export function webhookNotifier(options: WebhookNotifierOptions): WotchiNotifier {
  return createWebhookNotifier(options);
}
