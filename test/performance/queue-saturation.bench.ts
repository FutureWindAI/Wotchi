import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createWotchi } from "../../src/index.js";
import { wotchiErrorHandler } from "../../src/integrations/express/index.js";
import { registerWotchiNest } from "../../src/integrations/nest/index.js";
import type { WotchiNotifier } from "../../src/index.js";

const alphabeticId = (value: number): string => {
  const first = String.fromCharCode(65 + (value % 26));
  const second = String.fromCharCode(65 + Math.floor(value / 26));
  return `${first}${second}`;
};

const request = (server: http.Server, path: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      reject(new Error("test server has no TCP address"));
      return;
    }
    const current = http.request({ host: "127.0.0.1", port: address.port, path }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode ?? 0));
    });
    current.once("error", reject);
    current.end();
  });

const listen = async (server: http.Server): Promise<void> => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
};

const close = (server: http.Server): Promise<void> =>
  new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

test("queue saturation keeps pending alerts bounded while the notifier is blocked", async () => {
  let release!: () => void;
  let calls = 0;
  const notifier: WotchiNotifier = {
    name: "blocked-benchmark",
    async send(): Promise<void> {
      calls += 1;
      if (calls === 1) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
    },
  };
  const client = createWotchi({
    service: "queue-saturation",
    environment: "test",
    notifiers: [notifier],
    grouping: { alertThreshold: 1, maxGroups: 200 },
    queue: { maxPendingAlerts: 100, concurrency: 1 },
  });

  for (let index = 0; index < 250; index += 1) {
    client.captureException(new Error(`unique saturation error ${alphabeticId(index)}`));
  }

  const blocked = client.getDiagnostics();
  assert.equal(blocked.pendingAlerts, 100);
  assert.equal(blocked.alertsQueued, 101);
  assert.equal(blocked.alertsDropped, 149);

  release();
  await client.flush();
  assert.equal(client.getDiagnostics().pendingAlerts, 0);
  assert.equal(client.getDiagnostics().alertsSent, 101);
});

test("Express response completes while a saturated notifier remains blocked", async () => {
  let release!: () => void;
  const notifier: WotchiNotifier = {
    name: "blocked-express-benchmark",
    async send(): Promise<void> {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  };
  const client = createWotchi({
    service: "express-saturation",
    environment: "test",
    notifiers: [notifier],
    grouping: { alertThreshold: 1 },
  });
  const app = express();
  app.get("/error", () => {
    throw new Error("blocked express benchmark");
  });
  app.use(wotchiErrorHandler(client));
  app.use(
    (
      _error: unknown,
      _request: unknown,
      response: { status(code: number): { end(): void } },
      _next: (error: unknown) => void,
    ) => {
      response.status(500).end();
    },
  );
  const server = http.createServer(app);
  await listen(server);

  try {
    const status = await Promise.race([
      request(server, "/error"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Express timed out")), 500),
      ),
    ]);
    assert.equal(status, 500);
  } finally {
    release();
    await client.flush();
    await close(server);
  }
});

@Controller()
class SaturationController {
  @Get("/error")
  error(): never {
    throw new Error("blocked NestJS benchmark");
  }
}

@Module({ controllers: [SaturationController] })
class SaturationModule {}

test("NestJS response completes while a saturated notifier remains blocked", async () => {
  let release!: () => void;
  const notifier: WotchiNotifier = {
    name: "blocked-nest-benchmark",
    async send(): Promise<void> {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  };
  const client = createWotchi({
    service: "nest-saturation",
    environment: "test",
    notifiers: [notifier],
    grouping: { alertThreshold: 1 },
  });
  const app = await NestFactory.create(SaturationModule, { logger: false });
  registerWotchiNest(app, client);
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const status = await Promise.race([
      request(server, "/error"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("NestJS timed out")), 500),
      ),
    ]);
    assert.equal(status, 500);
  } finally {
    release();
    await client.flush();
    await app.close();
  }
});
