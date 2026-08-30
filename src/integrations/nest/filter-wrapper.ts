import type { ArgumentsHost } from "@nestjs/common";
import type { WotchiClient } from "../../core/types.js";
import { normalizeRequestContextOptions } from "../request-context.js";
import { captureWotchiNestException } from "./capture.js";
import type { NestWotchiOptions } from "./request-context.js";

export interface NestExceptionFilterLike {
  catch(exception: unknown, host: ArgumentsHost): void;
}

export function withWotchiNestFilter<TFilter extends NestExceptionFilterLike>(
  client: WotchiClient,
  filter: TFilter,
  options?: NestWotchiOptions,
): TFilter {
  const normalizedOptions = normalizeRequestContextOptions(options);
  const wrapped = Object.create(filter) as TFilter;
  Object.defineProperty(wrapped, "catch", {
    configurable: false,
    enumerable: false,
    value: (exception: unknown, host: ArgumentsHost): void => {
      captureWotchiNestException(client, exception, host, normalizedOptions);
      filter.catch(exception, host);
    },
    writable: false,
  });
  return wrapped;
}
