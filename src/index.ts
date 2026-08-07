import { createWotchi } from "./core/client.js";
import { registerWotchiProcessMonitor } from "./core/process-monitor.js";
import { consoleNotifier } from "./notifiers/console.js";
import { telegramNotifier } from "./notifiers/telegram.js";

export { WotchiConfigurationError } from "./core/errors.js";
export type { ProcessMonitorHandle } from "./core/process-monitor.js";
export type { NormalizedWotchiConfig } from "./core/config.js";

export type {
  ConsoleNotifierOptions,
  IncidentAlert,
  IncidentGroup,
  IncidentSeverity,
  SafeErrorEvent,
  TelegramNotifierOptions,
  WotchiClient,
  WotchiConfig,
  WotchiDiagnostics,
  WotchiEventInput,
  WotchiEventKind,
  WotchiNotifier,
  WotchiRequestContext,
} from "./core/types.js";

export { consoleNotifier, createWotchi, registerWotchiProcessMonitor, telegramNotifier };
