import type { HttpServer } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { WotchiClient } from "../../core/types.js";
import { WotchiNestExceptionFilter } from "./exception-filter.js";
import type { NestWotchiOptions } from "./request-context.js";
import { wotchiStatusObserver } from "../express/status-observer.js";
import type { WotchiStatusObserverOptions } from "../express/status-observer.js";

export type { NestWotchiOptions } from "./request-context.js";

export interface NestWotchiApplication {
  get(token: typeof HttpAdapterHost): InstanceType<typeof HttpAdapterHost>;
  getHttpAdapter?: () => unknown;
  use?: (...middleware: unknown[]) => unknown;
  useGlobalFilters(...filters: unknown[]): unknown;
}

export function registerWotchiNest(
  app: unknown,
  client: WotchiClient,
  options?: NestWotchiOptions,
): void {
  const application = app as NestWotchiApplication;
  const directAdapter = application.getHttpAdapter?.();
  const httpAdapter =
    directAdapter === undefined
      ? application.get(HttpAdapterHost).httpAdapter
      : (directAdapter as HttpServer);
  application.useGlobalFilters(new WotchiNestExceptionFilter(client, httpAdapter, options));
}

export function registerWotchiNestStatusObserver(
  app: unknown,
  client: WotchiClient,
  options?: WotchiStatusObserverOptions,
): void {
  const application = app as NestWotchiApplication;
  if (typeof application.use !== "function") {
    throw new TypeError(
      "Nest application does not expose use(); an Express-based adapter is required",
    );
  }
  application.use(wotchiStatusObserver(client, options));
}
