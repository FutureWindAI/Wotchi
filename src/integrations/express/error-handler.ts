import type { ErrorRequestHandler } from "express";
import type { WotchiClient } from "../../core/types.js";
import { normalizeRequestContextOptions } from "../request-context.js";
import { getExpressRequestContext, type ExpressWotchiOptions } from "./request-context.js";
import { markExpressErrorCaptured } from "./state.js";

export function createExpressErrorHandler(
  client: WotchiClient,
  options?: ExpressWotchiOptions,
): ErrorRequestHandler {
  const normalizedOptions = normalizeRequestContextOptions(options);
  return (error, request, response, next): void => {
    markExpressErrorCaptured(request);
    let captured = false;
    const captureAfterResponse = (): void => {
      if (captured) {
        return;
      }
      captured = true;
      response.off("finish", captureAfterResponse);
      response.off("close", captureAfterResponse);
      try {
        const requestContext = getExpressRequestContext(request, response, normalizedOptions);
        client.captureException(
          error,
          undefined,
          requestContext === undefined ? undefined : { request: requestContext },
        );
      } catch {
        // A capture failure must never change Express error handling.
      }
    };
    if (response.writableEnded || response.finished) {
      captureAfterResponse();
    } else {
      response.once("finish", captureAfterResponse);
      response.once("close", captureAfterResponse);
    }
    next(error);
  };
}
