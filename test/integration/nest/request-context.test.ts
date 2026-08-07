import assert from "node:assert/strict";
import test from "node:test";
import type { ArgumentsHost } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { getNestRequestContext } from "../../../src/integrations/nest/request-context.js";

test("Nest request context is bounded and excludes query data", () => {
  const request = {
    method: "GET",
    path: "/users/123",
    url: "/users/123?token=not-captured",
    requestId: "request-123",
    route: { path: "/users/:id" },
  };
  const response = { statusCode: 200 };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };
  const context = getNestRequestContext(host as ArgumentsHost, new HttpException("teapot", 418), {
    requestIdProperty: "requestId",
  });

  assert.deepEqual(context, {
    method: "GET",
    route: "/users/:id",
    statusCode: 418,
    requestId: "request-123",
  });
  assert.equal(JSON.stringify(context).includes("not-captured"), false);
});
