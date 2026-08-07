import type { Request, Response } from "express";
import { buildRequestContext, type RequestContextOptions } from "../request-context.js";
import type { WotchiRequestContext } from "../../core/types.js";

export type ExpressWotchiOptions = RequestContextOptions;

export function getExpressRequestContext(
  request: Request,
  response: Response,
  options?: ExpressWotchiOptions,
): WotchiRequestContext | undefined {
  try {
    const route = (request as Request & { route?: { path?: unknown } }).route?.path;
    return buildRequestContext({
      request,
      method: request.method,
      route: route ?? request.path,
      statusCode: response.statusCode,
      ...(options === undefined ? {} : { options }),
    });
  } catch {
    return undefined;
  }
}
