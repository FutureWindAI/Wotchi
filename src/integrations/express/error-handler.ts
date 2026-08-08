import type { ErrorRequestHandler } from "express";
import type { WotchiClient } from "../../core/types.js";
import { getExpressRequestContext, type ExpressWotchiOptions } from "./request-context.js";
import { markExpressErrorCaptured } from "./state.js";

export function createExpressErrorHandler(
  client: WotchiClient,
  options?: ExpressWotchiOptions,
): ErrorRequestHandler {
  return (error, request, response, next): void => {
    markExpressErrorCaptured(request);
    try {
      client.captureException(error, getExpressRequestContext(request, response, options));
    } catch {
      // A capture failure must never change Express error handling.
    }
    next(error);
  };
}
