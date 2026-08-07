import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUnknown } from "../../src/core/normalize.js";
import { redactValue } from "../../src/core/redact.js";

const limits = {
  maxDepth: 5,
  maxKeys: 100,
  maxStringLength: 500,
  maxStackLength: 4_000,
};

test("hostile unknown values cannot escape the safe input boundary", () => {
  const throwingProxy = new Proxy(
    {},
    {
      get() {
        throw new Error("hostile getter");
      },
      ownKeys() {
        throw new Error("hostile keys");
      },
    },
  );
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;

  for (const value of [
    new Error("error"),
    "string",
    42,
    false,
    null,
    undefined,
    Symbol("symbol"),
    10n,
    () => {
      throw new Error("must not run");
    },
    throwingProxy,
    cyclic,
  ]) {
    assert.doesNotThrow(() => normalizeUnknown(value, limits));
    assert.doesNotThrow(() => redactValue(value, limits));
  }
});

test("hostile nested metadata is bounded and secrets do not survive redaction", () => {
  const metadata: Record<string, unknown> = {
    authorization: "Bearer very-secret-token",
    nested: {
      password: "do-not-leak",
      values: Array.from({ length: 300 }, (_, index) => ({ index, token: `token-${index}` })),
    },
  };
  const result = redactValue(metadata, limits);
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes("very-secret-token"), false);
  assert.equal(serialized.includes("do-not-leak"), false);
  assert.equal(serialized.length < 50_000, true);
});
