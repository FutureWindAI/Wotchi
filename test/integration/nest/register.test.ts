import "reflect-metadata";
import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  Catch,
  type ArgumentsHost,
  Controller,
  Get,
  HttpCode,
  HttpException,
  type LoggerService,
  Module,
  Req,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createWotchi } from "../../../src/index.js";
import {
  registerWotchiNest,
  registerWotchiNestStatusObserver,
  withWotchiNestFilter,
} from "../../../src/integrations/nest/index.js";
import type { IncidentAlert, WotchiNotifier } from "../../../src/index.js";
import type { Request, Response } from "express";

const request = (
  server: http.Server,
  path: string,
  headers: http.OutgoingHttpHeaders = {},
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      reject(new Error("test server has no TCP address"));
      return;
    }
    const current = http.request(
      { host: "127.0.0.1", port: address.port, path, method: "GET", headers },
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
  @Get("/unauthorized")
  @HttpCode(401)
  unauthorized(): { error: string } {
    return { error: "missing-auth" };
  }

  @Get("/http-error/:id")
  httpError(): never {
    throw new HttpException({ message: "nest route failed", error: "Teapot" }, 418);
  }

  @Get("/generic-error")
  genericError(): never {
    throw new Error("nest generic failure");
  }

  @Get("/host-log-secret-error")
  hostLogSecretError(): never {
    throw new Error(
      "Nest database failure postgresql://db-user:WotchiNestHostLogCredentialCanary@db.internal:5432/orders",
    );
  }

  @Get("/metadata-error")
  metadataError(@Req() request: Request): never {
    const carrier = request as Request & Record<string, unknown>;
    carrier.requestId = request.header("x-request-id");
    carrier.correlationId = request.header("x-correlation-id");
    carrier.traceContext = {
      traceId: request.header("x-trace-id"),
      spanId: request.header("x-span-id"),
    };
    throw new Error("nest metadata failure");
  }
}

@Module({ controllers: [TestController] })
class TestModule {}

@Catch()
class ExistingGlobalExceptionFilter {
  public catch(_exception: unknown, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(422).json({
      code: "existing-filter-response",
    });
  }
}

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

test("NestJS registration preserves an existing global exception filter response", async () => {
  const captured: IncidentAlert[] = [];
  const client = createWotchi({
    service: "nest-existing-filter-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [
      {
        name: "test",
        async send(alert): Promise<void> {
          captured.push(alert);
        },
      },
    ],
  });
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalFilters(new ExistingGlobalExceptionFilter());
  registerWotchiNest(app, client);
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const response = await request(server, "/generic-error");
    await client.flush();
    assert.equal(response.status, 422);
    assert.deepEqual(JSON.parse(response.body), { code: "existing-filter-response" });
    assert.equal(captured.length, 1);
    assert.equal(captured[0]?.summary.includes("nest generic failure"), true);
  } finally {
    await app.close();
  }
});

test("NestJS default fallback does not forward a raw unknown exception to the host logger", async () => {
  const canary = "WotchiNestHostLogCredentialCanary";
  const hostErrors: unknown[][] = [];
  const logger: LoggerService = {
    log: () => undefined,
    error: (...messages: unknown[]) => hostErrors.push(messages),
    warn: () => undefined,
    debug: () => undefined,
    verbose: () => undefined,
    fatal: () => undefined,
  };
  const client = createWotchi({
    service: "nest-host-log-redaction-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [{ name: "test", async send(): Promise<void> {} }],
  });
  const app = await NestFactory.create(TestModule, { logger });
  registerWotchiNest(app, client);
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const response = await request(server, "/host-log-secret-error");
    await client.flush();
    assert.equal(response.status, 500);
    assert.equal(hostErrors.length, 0);
    assert.equal(JSON.stringify(hostErrors).includes(canary), false);
  } finally {
    await app.close();
  }
});

test("NestJS filter promotes request metadata for alert fields and links", async () => {
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "nest-metadata-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    links: {
      log: "https://logs.example.test/{{service}}/{{requestId}}",
      trace: "https://traces.example.test/{{traceId}}/{{spanId}}",
    },
    notifiers: [notifier],
  });
  const app = await NestFactory.create(TestModule, { logger: false });
  registerWotchiNest(app, client, {
    requestIdProperty: "requestId",
    correlationIdProperty: "correlationId",
    traceContextProperty: "traceContext",
  });
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const response = await request(server, "/metadata-error", {
      "x-request-id": "req-nest-42",
      "x-correlation-id": "corr-nest-42",
      "x-trace-id": "trace-nest-42",
      "x-span-id": "span-nest-42",
    });
    await client.flush();
    assert.equal(response.status, 500);
    assert.equal(captured.length, 1);
    assert.deepEqual(captured[0]?.request, {
      method: "GET",
      route: "/metadata-error",
      statusCode: 500,
      requestId: "req-nest-42",
      correlationId: "corr-nest-42",
      trace: { traceId: "trace-nest-42", spanId: "span-nest-42" },
    });
    assert.equal(captured[0]?.correlationId, "corr-nest-42");
    assert.deepEqual(captured[0]?.trace, {
      traceId: "trace-nest-42",
      spanId: "span-nest-42",
    });
    assert.deepEqual(captured[0]?.links, {
      log: "https://logs.example.test/nest-metadata-test/req-nest-42",
      trace: "https://traces.example.test/trace-nest-42/span-nest-42",
    });
  } finally {
    await app.close();
  }
});

test("NestJS status observer captures selected direct HTTP responses", async () => {
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "nest-status-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });
  const app = await NestFactory.create(TestModule, { logger: false });
  registerWotchiNestStatusObserver(app, client, { statusCodes: [401], statusClasses: [] });
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const response = await request(server, "/unauthorized");
    await client.flush();
    assert.equal(response.status, 401);
    assert.deepEqual(JSON.parse(response.body), { error: "missing-auth" });
    assert.equal(captured.length, 1);
    assert.equal(captured[0]?.summary.includes("HTTP 401"), true);
  } finally {
    await app.close();
  }
});

test("NestJS exception capture suppresses the matching status observer event", async () => {
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "nest-status-dedup-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });
  const app = await NestFactory.create(TestModule, { logger: false });
  registerWotchiNestStatusObserver(app, client, {
    statusCodes: [],
    statusClasses: ["5xx"],
  });
  registerWotchiNest(app, client);
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const response = await request(server, "/generic-error");
    await client.flush();
    assert.equal(response.status, 500);
    assert.equal(captured.length, 1);
    assert.equal(captured[0]?.summary.includes("nest generic failure"), true);
  } finally {
    await app.close();
  }
});

test("NestJS adapters reject unsafe request-context property names during setup", () => {
  const client = createWotchi({
    service: "nest-invalid-context-options-test",
    environment: "test",
    notifiers: [{ name: "test", async send(): Promise<void> {} }],
  });
  let adapterReads = 0;
  const app = {
    getHttpAdapter: () => {
      adapterReads += 1;
      return {};
    },
    useGlobalFilters: () => undefined,
  };

  assert.throws(
    () => registerWotchiNest(app, client, { traceContextProperty: "trace.context" }),
    /traceContextProperty must be a simple property name/,
  );
  assert.equal(adapterReads, 0);
  assert.throws(
    () =>
      withWotchiNestFilter(client, { catch: () => undefined }, { requestIdProperty: "req[id]" }),
    /requestIdProperty must be a simple property name/,
  );
});
