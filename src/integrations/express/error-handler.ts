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
      const requestContext = getExpressRequestContext(request, response, options);
      client.captureException(
        error,
        undefined,
        requestContext === undefined ? undefined : { request: requestContext },
      );
    } catch {
      // A capture failure must never change Express error handling.
    }
    next(error);
  };
}
