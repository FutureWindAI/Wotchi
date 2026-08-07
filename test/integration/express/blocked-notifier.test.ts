import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";
import { createWotchi } from "../../../src/index.js";
import { wotchiErrorHandler } from "../../../src/integrations/express/index.js";
import type { WotchiNotifier } from "../../../src/index.js";

const request = (server: http.Server): Promise<number> =>
  new Promise((resolve, reject) => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      reject(new Error("test server has no TCP address"));
      return;
    }
    const current = http.request(
      { host: "127.0.0.1", port: address.port, path: "/error" },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode ?? 0));
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

test("a blocked notifier does not delay the Express response", async () => {
  let release!: () => void;
  const notifier: WotchiNotifier = {
    name: "blocked",
    async send(): Promise<void> {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  };
  const client = createWotchi({
    service: "express-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });
  const app = express();
  app.get("/error", () => {
    throw new Error("blocked notifier error");
  });
  app.use(wotchiErrorHandler(client));
  app.use(
    (_error: unknown, _request: unknown, response: { status(code: number): { end(): void } }) => {
      response.status(500).end();
    },
  );

  const server = await listen(app);
  try {
    const response = await Promise.race([
      request(server),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error("response timed out")), 500),
      ),
    ]);
    assert.equal(response, 500);
    release();
    await client.flush();
  } finally {
    release();
    await close(server);
  }
});
