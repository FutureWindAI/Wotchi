import "reflect-metadata";
import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createWotchi } from "../../../src/index.js";
import { registerWotchiNest } from "../../../src/integrations/nest/index.js";
import type { WotchiNotifier } from "../../../src/index.js";

const request = (server: http.Server): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      reject(new Error("test server has no TCP address"));
      return;
    }
    const current = http.request(
      { host: "127.0.0.1", port: address.port, path: "/blocked", method: "GET" },
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

@Controller()
class BlockedController {
  @Get("/blocked")
  blocked(): never {
    throw new Error("blocked notifier route");
  }
}

@Module({ controllers: [BlockedController] })
class BlockedModule {}

test("a blocked notifier does not delay the NestJS response", async () => {
  let releaseNotifier: (() => void) | undefined;
  const notifier: WotchiNotifier = {
    name: "blocked",
    send: () =>
      new Promise<void>((resolve) => {
        releaseNotifier = resolve;
      }),
  };
  const client = createWotchi({
    service: "nest-blocked-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });
  const app = await NestFactory.create(BlockedModule, { logger: false });
  registerWotchiNest(app, client);
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const response = await Promise.race([
      request(server),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("NestJS response waited for notifier")), 500),
      ),
    ]);
    assert.equal(response.status, 500);
    assert.equal(response.body.includes("Internal server error"), true);
    releaseNotifier?.();
    await client.flush();
  } finally {
    releaseNotifier?.();
    await app.close();
  }
});
