import "reflect-metadata";
import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { Controller, Get, HttpException, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createWotchi } from "../../../src/index.js";
import { registerWotchiNest } from "../../../src/integrations/nest/index.js";
import type { IncidentAlert, WotchiNotifier } from "../../../src/index.js";

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

@Controller()
class TestController {
  @Get("/http-error/:id")
  httpError(): never {
    throw new HttpException({ message: "nest route failed", error: "Teapot" }, 418);
  }

  @Get("/generic-error")
  genericError(): never {
    throw new Error("nest generic failure");
  }
}

@Module({ controllers: [TestController] })
class TestModule {}

test("NestJS filter captures errors and preserves framework responses", async () => {
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "nest-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });
  const app = await NestFactory.create(TestModule, { logger: false });
  registerWotchiNest(app, client);
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const teapot = await request(server, "/http-error/123?secret=do-not-capture");
    const generic = await request(server, "/generic-error");
    await client.flush();

    assert.equal(teapot.status, 418);
    assert.deepEqual(JSON.parse(teapot.body), {
      message: "nest route failed",
      error: "Teapot",
    });
    assert.equal(generic.status, 500);
    assert.equal(generic.body.includes("Internal server error"), true);
    assert.equal(captured.length, 2);
    assert.equal(
      captured.some((alert) => alert.summary.includes("do-not-capture")),
      false,
    );
  } finally {
    await app.close();
  }
});
