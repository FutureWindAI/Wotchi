import { Catch, type ArgumentsHost, type HttpServer } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { WotchiClient } from "../../core/types.js";
import { markExpressErrorCaptured } from "../express/state.js";
import { getNestRequestContext, type NestWotchiOptions } from "./request-context.js";

@Catch()
export class WotchiNestExceptionFilter extends BaseExceptionFilter<unknown> {
  public constructor(
    private readonly client: WotchiClient,
    applicationRef: HttpServer,
    private readonly options?: NestWotchiOptions,
  ) {
    super(applicationRef);
  }

  public override catch(exception: unknown, host: ArgumentsHost): void {
    try {
      markExpressErrorCaptured(host.switchToHttp().getRequest());
    } catch {
      // Non-HTTP NestJS contexts do not expose an Express request to mark.
    }
    try {
      const requestContext = getNestRequestContext(host, exception, this.options);
      this.client.captureException(
        exception,
        undefined,
        requestContext === undefined ? undefined : { request: requestContext },
      );
    } catch {
      // A capture failure must never change NestJS exception handling.
    }
    super.catch(exception, host);
  }
}
