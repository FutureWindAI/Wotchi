import { Global, type DynamicModule, Module, type Provider } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { createWotchi } from "../../core/client.js";
import type { WotchiClient, WotchiConfig } from "../../core/types.js";
import { WotchiNestExceptionFilter } from "./exception-filter.js";

export const WOTCHI_CLIENT = Symbol("@futurewindai/wotchi/client");

export interface WotchiNestModuleOptions {
  registerGlobalFilter?: boolean;
}

@Global()
@Module({})
export class WotchiModule {
  public static forRoot(config: WotchiConfig, options?: WotchiNestModuleOptions): DynamicModule {
    const registerGlobalFilter = options?.registerGlobalFilter ?? true;
    const providers: Provider[] = [
      {
        provide: WOTCHI_CLIENT,
        useFactory: (): WotchiClient => createWotchi(config),
      },
    ];
    if (registerGlobalFilter) {
      providers.push({
        provide: APP_FILTER,
        useFactory: (client: WotchiClient): WotchiNestExceptionFilter =>
          new WotchiNestExceptionFilter(client),
        inject: [WOTCHI_CLIENT],
      });
    }
    return {
      module: WotchiModule,
      global: true,
      providers,
      exports: [WOTCHI_CLIENT],
    };
  }
}
