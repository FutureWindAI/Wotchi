import { createWotchi } from "./core/client.js";
import { registerWotchiProcessMonitor } from "./core/process-monitor.js";
import { createWotchiPrometheusExporter, PROMETHEUS_CONTENT_TYPE } from "./core/prometheus.js";
import { registerWotchiRuntimeWatcher } from "./core/runtime-monitor.js";
import { consoleNotifier } from "./notifiers/console.js";
import { telegramNotifier } from "./notifiers/telegram.js";
import { webhookNotifier } from "./notifiers/webhook.js";

export { WotchiConfigurationError } from "./core/errors.js";
export type { ProcessMonitorHandle } from "./core/process-monitor.js";
export type { NormalizedWotchiConfig } from "./core/config.js";
export type { WotchiPrometheusExporter } from "./core/prometheus.js";
export type {
  WotchiRuntimeWatcherHandle,
  WotchiRuntimeWatcherOptions,
} from "./core/runtime-monitor.js";

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
  WotchiEventKind,
  WotchiFingerprintOverride,
  WotchiFingerprintCallback,
  WotchiIncidentRule,
  WotchiLinkTemplates,
  WotchiLinks,
  WotchiNotifier,
  WotchiRequestContext,
  WotchiTags,
  WotchiTestAlertResult,
  WotchiTestAlertStatus,
  WotchiTraceContext,
} from "./core/types.js";

export type {
  WebhookRequestFunction,
  WebhookRequestOptions,
  WebhookResponse,
} from "./notifiers/webhook-http.js";

export {
  consoleNotifier,
  createWotchi,
  createWotchiPrometheusExporter,
  PROMETHEUS_CONTENT_TYPE,
  registerWotchiProcessMonitor,
  registerWotchiRuntimeWatcher,
  telegramNotifier,
  webhookNotifier,
};
