import type { TelegramNotifierOptions, WotchiNotifier } from "../core/types.js";
import { formatTelegramAlert } from "./telegram-format.js";
import {
  sendTelegramMessage,
  type TelegramRequestFunction,
  type TelegramSendOptions,
} from "./telegram-http.js";

const validateValue = (value: string, field: string): string => {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 200 ||
    /[\s/?#]/.test(value)
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return value.trim();
};

export function createTelegramNotifier(
  options: TelegramNotifierOptions,
  request?: TelegramRequestFunction,
): WotchiNotifier {
  const botToken = validateValue(options.botToken, "botToken");
  const chatId = validateValue(options.chatId, "chatId");
  const sendOptions: Omit<TelegramSendOptions, "text"> = {
    botToken,
    chatId,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  };
  return {
    name: "telegram",
    async send(alert): Promise<void> {
      const message = { ...sendOptions, text: formatTelegramAlert(alert) };
      if (request === undefined) {
        await sendTelegramMessage(message);
        return;
      }
      await sendTelegramMessage(message, request);
    },
  };
}

export function telegramNotifier(options: TelegramNotifierOptions): WotchiNotifier {
  return createTelegramNotifier(options);
}
