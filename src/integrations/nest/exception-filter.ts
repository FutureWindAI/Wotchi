import { Catch, type ArgumentsHost, type HttpServer } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { WotchiClient } from "../../core/types.js";
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
      this.client.captureException(exception, getNestRequestContext(host, exception, this.options));
    } catch {
      // A capture failure must never change NestJS exception handling.
    }
    super.catch(exception, host);
  }
}
