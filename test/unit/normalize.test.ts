import assert from "node:assert/strict";
import test from "node:test";
import { normalizeError, normalizeUnknown } from "../../src/core/normalize.js";
import type { NormalizationLimits } from "../../src/core/normalize.js";

const limits: NormalizationLimits = {
  maxDepth: 5,
  maxKeys: 100,
  maxStringLength: 500,
  maxStackLength: 4_000,
};

test("normalizes primitive and unsupported values into bounded safe values", () => {
  assert.equal(normalizeUnknown("hello", limits), "hello");
  assert.equal(String(normalizeUnknown("x".repeat(600), limits)).length, 500);
  assert.equal(normalizeUnknown(42, limits), 42);
  assert.equal(normalizeUnknown(true, limits), true);
  assert.equal(normalizeUnknown(null, limits), null);
  assert.equal(normalizeUnknown(undefined, limits), "[undefined]");
  assert.equal(normalizeUnknown(Symbol("secret"), limits), "[symbol]");
  assert.equal(normalizeUnknown(10n, limits), "[bigint]");
  assert.equal(
    normalizeUnknown(() => "must not run", limits),
    "[function]",
  );
});

test("normalizes Error values and bounds long stacks", () => {
  const error = new Error("failure");
  error.name = "DatabaseError";
  error.stack = "x".repeat(5_000);
  const normalized = normalizeError(error, limits);

  assert.equal(normalized.name, "DatabaseError");
  assert.equal(normalized.message, "failure");
  assert.equal(normalized.stack?.length, 4_000);
});

test("handles cycles, throwing getters, proxies, deep values, and key limits", () => {
  const cyclic: Record<string, unknown> = { value: "safe" };
  cyclic.self = cyclic;
  const cyclicResult = normalizeUnknown(cyclic, limits) as Record<string, unknown>;
  assert.equal(cyclicResult.value, "safe");
  assert.equal(cyclicResult.self, "[Circular]");

  const throwingGetter: Record<string, unknown> = {};
  Object.defineProperty(throwingGetter, "secret", {
    enumerable: true,
    get() {
      throw new Error("getter should not escape");
    },
  });
  const getterResult = normalizeUnknown(throwingGetter, limits) as Record<string, unknown>;
  assert.equal(getterResult.secret, "[unreadable value]");

  const rejectedProxy = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error("proxy should not escape");
      },
    },
  );
  assert.equal(normalizeUnknown(rejectedProxy, limits), "[unreadable value]");

  const deep: Record<string, unknown> = {};
  let cursor = deep;
  for (let index = 0; index < 10; index += 1) {
    cursor.next = {};
    cursor = cursor.next as Record<string, unknown>;
  }
  const deepResult = JSON.stringify(normalizeUnknown(deep, limits));
  assert.equal(deepResult.includes("[MaxDepth]"), true);

  const manyKeys = Object.fromEntries(
    Array.from({ length: 150 }, (_, index) => [`key-${index}`, index]),
  );
  const manyKeysResult = normalizeUnknown(manyKeys, limits) as Record<string, unknown>;
  assert.equal(Object.keys(manyKeysResult).length <= 100, true);
});

test("does not retain raw object references", () => {
  const source = { nested: { value: "before" } };
  const normalized = normalizeUnknown(source, limits) as { nested: { value: string } };
  source.nested.value = "after";

  assert.equal(normalized.nested.value, "before");
});
