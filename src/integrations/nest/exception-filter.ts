import { Catch, HttpException, type ArgumentsHost, type HttpServer } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { WotchiClient } from "../../core/types.js";
import { normalizeRequestContextOptions } from "../request-context.js";
import { captureWotchiNestException } from "./capture.js";
import type { NestExceptionFilterLike } from "./filter-wrapper.js";
import type { NestWotchiOptions } from "./request-context.js";

type ExceptionConstructor = abstract new (...args: never[]) => unknown;
const FILTER_CATCH_EXCEPTIONS = "__filterCatchExceptions__";

const matchesException = (filter: NestExceptionFilterLike, exception: unknown): boolean => {
  const reflection = Reflect as typeof Reflect & {
    getMetadata?: (metadataKey: string, target: object) => unknown;
  };
  const exceptionTypes = reflection.getMetadata?.(FILTER_CATCH_EXCEPTIONS, filter.constructor);
  if (!Array.isArray(exceptionTypes) || exceptionTypes.length === 0) {
    return true;
  }
  return exceptionTypes.some(
    (exceptionType): boolean =>
      typeof exceptionType === "function" &&
      exception instanceof (exceptionType as ExceptionConstructor),
  );
};

@Catch()
export class WotchiNestExceptionFilter extends BaseExceptionFilter<unknown> {
  private readonly options: NestWotchiOptions;

  public constructor(
    private readonly client: WotchiClient,
    applicationRef?: HttpServer,
    options?: NestWotchiOptions,
    private readonly previousGlobalFilters: readonly NestExceptionFilterLike[] = [],
  ) {
    super(applicationRef);
    this.options = normalizeRequestContextOptions(options);
  }

  public override catch(exception: unknown, host: ArgumentsHost): void {
    captureWotchiNestException(this.client, exception, host, this.options);
    const existingFilter = this.previousGlobalFilters.find((filter) =>
      matchesException(filter, exception),
    );
    if (existingFilter !== undefined) {
      existingFilter.catch(exception, host);
      return;
    }
    this.respondWithoutLoggingRawUnknownException(exception, host);
  }

  private respondWithoutLoggingRawUnknownException(exception: unknown, host: ArgumentsHost): void {
    if (this.applicationRef === undefined) {
      this.respondThroughExpressAdapter(exception, host);
      return;
    }
    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }

    const response = host.getArgByIndex(1);
    if (this.applicationRef.isHeadersSent(response)) {
      this.applicationRef.end(response);
      return;
    }

    if (this.isHttpError(exception)) {
      this.applicationRef.reply(
        response,
        { statusCode: exception.statusCode, message: exception.message },
        exception.statusCode,
      );
      return;
    }

    this.applicationRef.reply(response, { statusCode: 500, message: "Internal server error" }, 500);
  }

  private respondThroughExpressAdapter(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      headersSent?: boolean;
      end: (body?: string) => void;
      json: (body: unknown) => void;
      status: (statusCode: number) => { json: (body: unknown) => void };
    }>();
    if (response.headersSent) {
      response.end();
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      response
        .status(statusCode)
        .json(
          typeof exceptionResponse === "object" && exceptionResponse !== null
            ? exceptionResponse
            : { statusCode, message: exceptionResponse },
        );
      return;
    }
    if (this.isHttpError(exception)) {
      response.status(exception.statusCode).json({
        statusCode: exception.statusCode,
        message: exception.message,
      });
      return;
    }
    response.status(500).json({ statusCode: 500, message: "Internal server error" });
  }
}
