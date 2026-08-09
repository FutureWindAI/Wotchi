import assert from "node:assert/strict";
import test from "node:test";
import { REDACTED, redactError, redactValue } from "../../src/core/redact.js";

test("redacts default keys regardless of case and separators", () => {
  const result = redactValue({
    Authorization: "raw-authorization",
    "api-key": "raw-api-key",
    api_key: "raw-api-key-2",
    PASSWORD: "raw-password",
    nested: {
      refreshToken: "raw-refresh-token",
    },
    ordinary: "the token bucket is empty",
  }) as Record<string, unknown>;

  assert.equal(result.Authorization, REDACTED);
  assert.equal(result["api-key"], REDACTED);
  assert.equal(result.api_key, REDACTED);
  assert.equal(result.PASSWORD, REDACTED);
  assert.deepEqual(result.nested, { refreshToken: REDACTED });
  assert.equal(result.ordinary, "the token bucket is empty");
});

test("redacts custom keys, secret patterns, and card-like values", () => {
  const privateKey = "-----BEGIN PRIVATE KEY-----\\nprivate-value\\n-----END PRIVATE KEY-----"; // gitleaks:allow
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature-value";
  const result = redactValue(
    {
      customerSecret: "custom-secret",
      text: `Bearer abc.def.ghi ${jwt} ${privateKey}`,
      card: "4111 1111 1111 1111",
      ordinaryNumber: "1234567890123",
      nested: ["sk-not-a-real-secret", { client_secret: "another-secret" }],
    },
    { redactKeys: ["customerSecret"] },
  );
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes("custom-secret"), false);
  assert.equal(serialized.includes("abc.def.ghi"), false);
  assert.equal(serialized.includes(jwt), false);
  assert.equal(serialized.includes("private-value"), false);
  assert.equal(serialized.includes("4111 1111 1111 1111"), false);
  assert.equal(serialized.includes("sk-not-a-real-secret"), false);
  assert.equal(serialized.includes("another-secret"), false);
  assert.equal(serialized.includes("1234567890123"), true);
});

test("redacts nested arrays and normalized Error fields without retaining secrets", () => {
  const error = new Error("Bearer error-token");
  error.stack = `Error: ${error.message}\n  at handler (app.js:10:4)\n  authorization: secret-stack-token`;
  const result = redactError(
    {
      name: "Error",
      message: error.message,
      stack: error.stack,
      code: "E_SECRET",
    },
    { redactKeys: ["code"] },
  );

  assert.equal(result.message.includes("error-token"), false);
  assert.equal(result.stack?.includes("secret-stack-token"), false);
  assert.equal(result.code, REDACTED);
  assert.equal(
    JSON.stringify(redactValue(["Bearer array-token", { token: "raw" }])).includes("raw"),
    false,
  );
});

test("preserves ordinary text and applies a bounded output length", () => {
  const ordinary = "This sentence mentions authorization as a concept, not a credential.";
  const result = redactValue(
    { ordinary, long: "x".repeat(800) },
    { maxStringLength: 100 },
  ) as Record<string, unknown>;

  assert.equal(result.ordinary, ordinary);
  assert.equal(typeof result.long, "string");
  assert.equal((result.long as string).length <= 100, true);
});

test("redacts credentials embedded in supported connection URLs", () => {
  const values = [
    "postgres://db-user:postgres-password@db.internal:5432/orders",
    "postgresql://db-user:postgres-password@db.internal:5432/orders?sslmode=require",
    "redis://default:redis-password@cache.internal:6379/0",
    "rediss://default:redis-password@cache.internal:6380/0",
    "mongodb://mongo-user:mongo-password@db.internal:27017/orders",
    "mongodb+srv://mongo-user:mongo-password@cluster.example/orders",
  ];

  const output = JSON.stringify(redactValue({ values }));

  for (const secret of ["postgres-password", "redis-password", "mongo-password"]) {
    assert.equal(output.includes(secret), false, `${secret} was not redacted`);
  }
  assert.equal(output.includes("db.internal"), true);
  assert.equal(output.includes(REDACTED), true);
});

test("redacts connection URL query credentials and encoded passwords", () => {
  const output = JSON.stringify(
    redactValue({
      postgres:
        "postgres://user:p%40ssword@db.internal:5432/orders?password=query-password&sslpassword=ssl-password",
      redis: "redis://cache.internal:6379/0?token=query-token",
    }),
  );

  for (const secret of ["p%40ssword", "query-password", "ssl-password", "query-token"]) {
    assert.equal(output.includes(secret), false, `${secret} was not redacted`);
  }
});

test("redacts header, query, cookie, and webhook path secret variants", () => {
  const canaries = [
    "WotchiBasicCredentialCanary",
    "WotchiXApiKeyCanary",
    "WotchiDbPasswordCanary",
    "WotchiCookieCanary",
    "WotchiSignatureCanary",
    "WotchiEncodedQueryCanary",
    "WotchiWebhookPathCanary",
  ];
  const output = JSON.stringify(
    redactValue({
      authorization: "Basic V290Y2hpQmFzaWNDYW5hcnk=",
      xApiKey: canaries[1],
      dbPassword: canaries[2],
      cookieText: "Cookie: session=" + canaries[3],
      signatureUrl: "https://hooks.example.test/callback?signature=" + canaries[4],
      encodedUrl: "https://hooks.example.test/callback?t%6fken=" + canaries[5],
      webhookUrl: "https://hooks.example.test/services/" + canaries[6],
    }),
  );

  for (const canary of canaries) {
    assert.equal(output.includes(canary), false, canary + " escaped redaction");
  }
});
