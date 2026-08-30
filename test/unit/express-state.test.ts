import assert from "node:assert/strict";
import test from "node:test";
import {
  markExpressErrorCaptured,
  wasExpressErrorCaptured,
} from "../../src/integrations/express/state.js";

test("Express capture state supports frozen host request objects", () => {
  const request = Object.freeze({});

  markExpressErrorCaptured(request);

  assert.equal(wasExpressErrorCaptured(request), true);
});

test("Express capture state does not add private properties to the host request", () => {
  const request = {};

  markExpressErrorCaptured(request);

  assert.deepEqual(Reflect.ownKeys(request), []);
  assert.equal(wasExpressErrorCaptured(request), true);
});
