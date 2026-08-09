import type { WotchiClient } from "../../core/types.js";
import { createExpressErrorHandler } from "./error-handler.js";
import type { ExpressWotchiOptions } from "./request-context.js";

export { consoleNotifier, createWotchi, telegramNotifier, webhookNotifier } from "../../index.js";

export type {
  ConsoleNotifierOptions,
  IncidentAlert,
  IncidentGroup,
  IncidentSeverity,
  SafeErrorEvent,
  TelegramNotifierOptions,
  WebhookNotifierOptions,
  WotchiBeforeSend,
  WotchiCaptureOptions,
  WotchiClient,
  WotchiConfig,
  WotchiDiagnostics,
  WotchiEventFilter,
  WotchiEventInput,
  WotchiFingerprintCallback,
  WotchiFingerprintOverride,
  WotchiIncidentRule,
  WotchiLinkTemplates,
  WotchiLinks,
  WotchiNotifier,
  WotchiRequestContext,
  WotchiTags,
  WotchiTestAlertResult,
  WotchiTestAlertStatus,
  WotchiTraceContext,
} from "../../index.js";

export type { ExpressWotchiOptions } from "./request-context.js";
export type { WotchiStatusClass, WotchiStatusObserverOptions } from "./status-observer.js";
export { wotchiStatusObserver } from "./status-observer.js";

export function wotchiErrorHandler(
  client: WotchiClient,
  options?: ExpressWotchiOptions,
): ReturnType<typeof createExpressErrorHandler> {
  return createExpressErrorHandler(client, options);
}
