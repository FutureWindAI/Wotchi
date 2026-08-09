import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";
import type { ErrorRequestHandler, Request, RequestHandler } from "express";
import { createWotchi } from "../../../src/index.js";
import * as expressIntegration from "../../../src/integrations/express/index.js";
import type { IncidentAlert, WotchiClient, WotchiNotifier } from "../../../src/index.js";

const wotchiErrorHandler = expressIntegration.wotchiErrorHandler;
const wotchiStatusObserver = (
  expressIntegration as unknown as {
    wotchiStatusObserver: (
      client: WotchiClient,
      options?: {
        statusCodes?: readonly number[];
        statusClasses?: readonly string[];
        ignoreStatusCodes?: readonly number[];
        alertThreshold?: number;
      },
    ) => RequestHandler;
  }
).wotchiStatusObserver;

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

test("Express error handler promotes request metadata for alert fields and links", async () => {
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "express-metadata-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    links: {
      log: "https://logs.example.test/{{service}}/{{requestId}}",
      trace: "https://traces.example.test/{{traceId}}/{{spanId}}",
    },
    notifiers: [notifier],
  });
  const app = express();
  app.get("/metadata", (request: Request, response) => {
    const carrier = request as Request & Record<string, unknown>;
    carrier.requestId = "req-express-42";
    carrier.correlationId = "corr-express-42";
    carrier.traceContext = { traceId: "trace-express-42", spanId: "span-express-42" };
    response.status(500);
    throw new Error("express metadata failure");
  });
  app.use(
    wotchiErrorHandler(client, {
      requestIdProperty: "requestId",
      correlationIdProperty: "correlationId",
      traceContextProperty: "traceContext",
    }),
  );
  app.use((_error: unknown, _request: Request, response: express.Response) => {
    response.status(500).json({ error: "handled" });
  });

  const server = await listen(app);
  try {
    const response = await request(server, "/metadata");
    await client.flush();
    assert.equal(response.status, 500);
    assert.equal(captured.length, 1);
    assert.deepEqual(captured[0]?.request, {
      method: "GET",
      route: "/metadata",
      statusCode: 500,
      requestId: "req-express-42",
      correlationId: "corr-express-42",
      trace: { traceId: "trace-express-42", spanId: "span-express-42" },
    });
    assert.equal(captured[0]?.correlationId, "corr-express-42");
    assert.deepEqual(captured[0]?.trace, {
      traceId: "trace-express-42",
      spanId: "span-express-42",
    });
    assert.deepEqual(captured[0]?.links, {
      log: "https://logs.example.test/express-metadata-test/req-express-42",
      trace: "https://traces.example.test/trace-express-42/span-express-42",
    });
  } finally {
    await close(server);
  }
});

test("Express status observer captures selected direct HTTP responses", async () => {
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "express-status-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });
  const app = express();
  app.use(wotchiStatusObserver(client, { statusCodes: [401], statusClasses: [] }));
  app.get("/private", (_request, response) => {
    response.status(401).json({ error: "missing-auth" });
  });

  const server = await listen(app);
  try {
    const response = await request(server, "/private");
    await client.flush();
    assert.equal(response.status, 401);
    assert.equal(response.body, '{"error":"missing-auth"}');
    assert.equal(captured.length, 1);
    assert.equal(captured[0]?.summary.includes("HTTP 401"), true);
  } finally {
    await close(server);
  }
});

test("Express status observer supports ignored statuses and a per-status threshold", async () => {
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "express-status-policy-test",
    environment: "test",
    notifiers: [notifier],
  });
  const app = express();
  app.use(
    wotchiStatusObserver(client, {
      statusCodes: [429],
      statusClasses: [],
      ignoreStatusCodes: [],
      alertThreshold: 2,
    }),
  );
  app.get("/rate-limit", (_request, response) => {
    response.status(429).json({ error: "rate-limited" });
  });

  const server = await listen(app);
  try {
    await request(server, "/rate-limit");
    await request(server, "/rate-limit");
    await client.flush();
    assert.equal(captured.length, 1);
    assert.equal(captured[0]?.occurrences, 2);
  } finally {
    await close(server);
  }
});

test("Express status observer can ignore a noisy status", async () => {
  const captured: IncidentAlert[] = [];
  const notifier: WotchiNotifier = {
    name: "test",
    async send(alert): Promise<void> {
      captured.push(alert);
    },
  };
  const client = createWotchi({
    service: "express-status-ignore-test",
    environment: "test",
    grouping: { alertThreshold: 1 },
    notifiers: [notifier],
  });
  const app = express();
  app.use(
    wotchiStatusObserver(client, {
      statusCodes: [429],
      statusClasses: [],
      ignoreStatusCodes: [429],
    }),
  );
  app.get("/rate-limit", (_request, response) => {
    response.status(429).end();
  });

  const server = await listen(app);
  try {
    const response = await request(server, "/rate-limit");
    await client.flush();
    assert.equal(response.status, 429);
    assert.equal(captured.length, 0);
  } finally {
    await close(server);
  }
});

test("Express status observer rejects unbounded policy options", () => {
  const client = createWotchi({
    service: "express-status-validation-test",
    environment: "test",
    notifiers: [consoleNotifierForValidation()],
  });

  assert.throws(
    () => wotchiStatusObserver(client, { statusCodes: [600] }),
    /statusCodes must contain HTTP status codes/,
  );
  assert.throws(
    () => wotchiStatusObserver(client, { alertThreshold: 1_000_001 }),
    /alertThreshold must be a positive integer/,
  );
});

const consoleNotifierForValidation = (): WotchiNotifier => ({
  name: "validation",
  async send(): Promise<void> {},
});

void (null as unknown as WotchiClient);
