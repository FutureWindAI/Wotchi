import type { ArgumentsHost, HttpException } from "@nestjs/common";
import { buildRequestContext, type RequestContextOptions } from "../request-context.js";
import type { WotchiRequestContext } from "../../core/types.js";

export type NestWotchiOptions = RequestContextOptions;

interface NestRequestLike {
  method?: unknown;
  path?: unknown;
  url?: unknown;
  route?: {
    path?: unknown;
  };
}

interface NestResponseLike {
  statusCode?: unknown;
}

const isHttpException = (exception: unknown): exception is HttpException =>
  typeof exception === "object" &&
  exception !== null &&
  typeof (exception as { getStatus?: unknown }).getStatus === "function";

const getStatusCode = (exception: unknown, response: NestResponseLike): number | undefined => {
  if (isHttpException(exception)) {
    try {
      const status = exception.getStatus();
      return Number.isSafeInteger(status) ? status : undefined;
    } catch {
      return undefined;
    }
  }
  return typeof response.statusCode === "number" &&
    Number.isSafeInteger(response.statusCode) &&
    response.statusCode >= 400
    ? response.statusCode
    : 500;
};

export function getNestRequestContext(
  host: ArgumentsHost,
  exception: unknown,
  options?: NestWotchiOptions,
): WotchiRequestContext | undefined {
  try {
    const httpHost = host.switchToHttp();
    const request = httpHost.getRequest<NestRequestLike>();
    const response = httpHost.getResponse<NestResponseLike>();
    const route = request.route?.path ?? request.path ?? request.url;
    return buildRequestContext({
      request,
      method: request.method,
      route,
      statusCode: getStatusCode(exception, response),
      ...(options === undefined ? {} : { options }),
    });
  } catch {
    return undefined;
  }
}
