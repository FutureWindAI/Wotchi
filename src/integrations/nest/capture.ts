import type { ArgumentsHost } from "@nestjs/common";
import type { WotchiClient } from "../../core/types.js";
import { markExpressErrorCaptured } from "../express/state.js";
import { getNestRequestContext, type NestWotchiOptions } from "./request-context.js";

export const captureWotchiNestException = (
  client: WotchiClient,
  exception: unknown,
  host: ArgumentsHost,
  options?: NestWotchiOptions,
): void => {
  try {
    markExpressErrorCaptured(host.switchToHttp().getRequest());
  } catch {
    // Non-HTTP NestJS contexts do not expose an Express request to mark.
  }
  try {
    const requestContext = getNestRequestContext(host, exception, options);
    client.captureException(
      exception,
      undefined,
      requestContext === undefined ? undefined : { request: requestContext },
    );
  } catch {
    // A capture failure must never change NestJS exception handling.
  }
};
