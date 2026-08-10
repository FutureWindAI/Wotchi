import assert from "node:assert/strict";
import test from "node:test";
import { redactValue } from "../../src/core/redact.js";

const corpus = [
  {
    name: "bearer token",
    value: "Bearer ghp_example-secret-token-value",
  },
  {
    name: "jwt",
    value: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ3b3RjaGkifQ.signature-value",
  },
  {
    name: "short-segment jwt",
    value: "eyJhbGciOiJIUzI1NiJ9.SecretJwt_20260810.signature",
  },
  {
    name: "private key",
    value: "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----", // gitleaks:allow
  },
  {
    name: "payment card",
    value: "4111 1111 1111 1111",
  },
  {
    name: "stripe key",
    value: "sk-not-a-real-secret",
  },
  {
    name: "single-label database authority credential",
    value: "db-user:single-label-password@postgres:5432",
  },
] as const;

test("redaction corpus removes credential-shaped values before storage or transport", () => {
  for (const entry of corpus) {
    const output = JSON.stringify(
      redactValue({
        message: `fixture ${entry.value}`,
        nested: { value: entry.value },
      }),
    );
    assert.equal(output.includes(entry.value), false, `${entry.name} was not redacted`);
  }
});

test("redaction remains bounded for high-cardinality corpus input", () => {
  const output = redactValue(
    Array.from({ length: 1_000 }, (_, index) => ({
      authorization: `Bearer fixture-token-${index}`,
      message: `error-${index}`,
    })),
    { maxKeys: 100, maxStringLength: 200 },
  );
  assert.equal(JSON.stringify(output).length < 50_000, true);
});
