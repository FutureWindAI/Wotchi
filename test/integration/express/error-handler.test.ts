import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { createWotchi } from "../../../src/index.js";
import { wotchiErrorHandler } from "../../../src/integrations/express/index.js";
import type { IncidentAlert, WotchiClient, WotchiNotifier } from "../../../src/index.js";

const request = (server: http.Server, path: string): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      reject(new Error("test server has no TCP address"));
      return;
    }
    const current = http.request(
      { host: "127.0.0.1", port: address.port, path, method: "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    current.once("error", reject);
    current.end();
  });

const listen = async (app: ReturnType<typeof express>): Promise<http.Server> => {
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
};

const close = (server: http.Server): Promise<void> =>
  new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

test("Express middleware captures and passes the original error to the existing handler", async () => {
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "express-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });
  const app = express();
  const originalError = new Error("express route failed");
  let seenError: unknown;
  let finalHandlerCalls = 0;

  app.get("/orders/:id", (_request, response) => {
    response.status(418);
    throw originalError;
  });
  app.use(wotchiErrorHandler(client));
  const finalErrorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    finalHandlerCalls += 1;
    seenError = error;
    response.status(418).json({ error: "existing-handler" });
  };
  app.use(finalErrorHandler);

  const server = await listen(app);
  try {
    const response = await request(server, "/orders/123?secret=do-not-capture");
    await client.flush();
    assert.equal(response.status, 418);
    assert.equal(response.body, '{"error":"existing-handler"}');
    assert.strictEqual(seenError, originalError);
    assert.equal(finalHandlerCalls, 1);
    assert.equal(captured.length, 1);
    assert.equal(captured[0]?.summary.includes("do-not-capture"), false);
  } finally {
    await close(server);
  }
});

void (null as unknown as WotchiClient);
