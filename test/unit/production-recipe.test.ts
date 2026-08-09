import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import express from "express";
import { productionErrorHandler } from "../../examples/production-recipe/src/error-handler.js";
import {
  closeServerWithTimeout,
  drainNotifications,
} from "../../examples/production-recipe/src/shutdown.js";

const listen = async (server: http.Server): Promise<void> => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
};

const request = (server: http.Server): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      reject(new Error("test server has no TCP address"));
      return;
    }
    const current = http.request(
      { host: "127.0.0.1", port: address.port, path: "/failure" },
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

test("production error middleware returns a generic JSON response", async () => {
  const app = express();
  app.get("/failure", () => {
    throw new Error("database password=super-secret");
  });
  app.use(productionErrorHandler);
  const server = http.createServer(app);
  await listen(server);

  try {
    const response = await request(server);
    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(response.body), { error: "Internal server error" });
    assert.equal(response.body.includes("super-secret"), false);
  } finally {
    await closeServerWithTimeout(server, 100);
  }
});

test("production shutdown force-closes an open client before draining", async () => {
  const server = http.createServer(() => undefined);
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("test server has no TCP address");
  }
  const socket = net.createConnection({ host: "127.0.0.1", port: address.port });
  await once(socket, "connect");

  await closeServerWithTimeout(server, 10);
  await Promise.race([
    once(socket, "close"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("socket remained open")), 200)),
  ]);
  assert.equal(server.listening, false);
  socket.destroy();
});

test("production shutdown contains a rejected notification flush", async () => {
  const messages: string[] = [];
  await assert.doesNotReject(
    drainNotifications(
      async () => {
        throw new Error("flush secret");
      },
      3_000,
      (message: string) => messages.push(message),
    ),
  );
  assert.deepEqual(messages, ["Wotchi notification drain did not finish before shutdown timeout."]);
});
