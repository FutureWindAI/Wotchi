import express from "express";
import { consoleNotifier, createWotchi, webhookNotifier } from "@futurewindai/wotchi";
import { wotchiErrorHandler } from "@futurewindai/wotchi/express";
import { productionErrorHandler } from "./error-handler.js";
import { closeServerWithTimeout, drainNotifications } from "./shutdown.js";

const SERVER_CLOSE_TIMEOUT_MS = 1_000;
const WOTCHI_FLUSH_TIMEOUT_MS = 3_000;

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} must be configured`);
  }
  return value;
};

const app = express();
const port = Number(process.env.PORT ?? "3000");
const webhookUrl = process.env.WOTCHI_WEBHOOK_URL;
const webhookAuth = process.env.WOTCHI_WEBHOOK_AUTH;
const notifiers = [consoleNotifier()];

if (webhookUrl !== undefined) {
  notifiers.push(
    webhookNotifier({
      url: webhookUrl,
      ...(webhookAuth === undefined ? {} : { headers: { Authorization: webhookAuth } }),
    }),
  );
}

const wotchi = createWotchi({
  service: requiredEnv("WOTCHI_SERVICE"),
  environment: requiredEnv("WOTCHI_ENVIRONMENT"),
  ...(process.env.WOTCHI_RELEASE === undefined ? {} : { release: process.env.WOTCHI_RELEASE }),
  ...(process.env.WOTCHI_INSTANCE === undefined ? {} : { instance: process.env.WOTCHI_INSTANCE }),
  grouping: { alertThreshold: 3 },
  notifiers,
});

app.get("/healthz", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/failure", () => {
  throw new Error("production recipe synthetic failure");
});

app.use(wotchiErrorHandler(wotchi));
app.use(productionErrorHandler);

const server = app.listen(port, () => {
  console.log(`Wotchi production recipe listening on port ${port}`);
});

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Received ${signal}; draining Wotchi notifications.`);
  await closeServerWithTimeout(server, SERVER_CLOSE_TIMEOUT_MS);
  await drainNotifications(
    (timeoutMs) => wotchi.shutdown(timeoutMs),
    WOTCHI_FLUSH_TIMEOUT_MS,
    (message) => console.error(message),
  );
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
