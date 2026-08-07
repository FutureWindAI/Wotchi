const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
Module._load = function guardedLoad(request, parent, isMain) {
  if (request === "@nestjs/common" || request === "@nestjs/core") {
    throw new Error(
      `Unexpected NestJS runtime load while testing framework-independent entry points: ${request}`,
    );
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  assert.equal(typeof require("@futurewindai/wotchi").createWotchi, "function");
  assert.equal(typeof require("@futurewindai/wotchi/express").wotchiErrorHandler, "function");
} finally {
  Module._load = originalLoad;
}
