import "reflect-metadata";
import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  BadRequestException,
  Catch,
  type ArgumentsHost,
  Controller,
  Get,
  HttpException,
  Module,
} from "@nestjs/common";
import { APP_FILTER, NestFactory } from "@nestjs/core";
import type { IncidentAlert, WotchiClient, WotchiNotifier } from "../../../src/index.js";
import {
  withWotchiNestFilter,
  WotchiModule,
  WOTCHI_CLIENT,
} from "../../../src/integrations/nest/index.js";

const wrappedFilterAlerts: IncidentAlert[] = [];
const moduleAlerts: IncidentAlert[] = [];

const request = (server: http.Server, path: string): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      reject(new Error("test server has no TCP address"));
      return;
    }
    const current = http.request(
      { host: "127.0.0.1", port: address.port, path, method: "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    current.once("error", reject);
    current.end();
  });

@Controller()
class ModuleTestController {
  @Get("/failure")
  failure(): never {
    throw new Error("module integration failure");
  }

  @Get("/bad-request")
  badRequest(): never {
    throw new BadRequestException("module integration invalid input");
  }

  @Get("/string-http-exception")
  stringHttpException(): never {
    throw new HttpException("module string response", 418);
  }
}

@Catch()
class ExistingAppFilter {
  public catch(_exception: unknown, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<http.ServerResponse>().writeHead(422, {
      "content-type": "application/json",
    });
    host.switchToHttp().getResponse<http.ServerResponse>().end('{"code":"existing-filter"}');
  }
}

@Module({
  imports: [
    WotchiModule.forRoot(
      {
        service: "nest-filter-wrapper-test",
        environment: "test",
        grouping: { alertThreshold: 1 },
        notifiers: [
          {
            name: "custom-filter-test",
            async send(alert): Promise<void> {
              wrappedFilterAlerts.push(alert);
            },
          },
        ],
      },
      { registerGlobalFilter: false },
    ),
  ],
  controllers: [ModuleTestController],
  providers: [
    ExistingAppFilter,
    {
      provide: APP_FILTER,
      useFactory: (client: WotchiClient, filter: ExistingAppFilter) =>
        withWotchiNestFilter(client, filter),
      inject: [WOTCHI_CLIENT, ExistingAppFilter],
    },
  ],
})
class WrappedFilterModule {}

const moduleNotifier: WotchiNotifier = {
  name: "module-test",
  async send(alert): Promise<void> {
    moduleAlerts.push(alert);
  },
};

@Module({
  imports: [
    WotchiModule.forRoot({
      service: "nest-module-test",
      environment: "test",
      grouping: { alertThreshold: 1 },
      notifiers: [moduleNotifier],
    }),
  ],
  controllers: [ModuleTestController],
})
class WotchiConfiguredModule {}

test("withWotchiNestFilter captures an APP_FILTER error and preserves its response", async () => {
  wrappedFilterAlerts.length = 0;
  const app = await NestFactory.create(WrappedFilterModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const response = await request(server, "/failure");
    await app.get<WotchiClient>(WOTCHI_CLIENT).flush();
    assert.equal(response.status, 422);
    assert.deepEqual(JSON.parse(response.body), { code: "existing-filter" });
    assert.equal(wrappedFilterAlerts.length, 1);
    assert.equal(wrappedFilterAlerts[0]?.summary.includes("module integration failure"), true);
  } finally {
    await app.close();
  }
});

test("WotchiModule captures controller failures without main.ts registration", async () => {
  moduleAlerts.length = 0;
  const app = await NestFactory.create(WotchiConfiguredModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer() as http.Server;

  try {
    const response = await request(server, "/failure");
    const client = app.get<WotchiClient>(WOTCHI_CLIENT);
    await client.flush();
    assert.equal(response.status, 500);
    assert.equal(moduleAlerts.length, 1);
    assert.equal(moduleAlerts[0]?.summary.includes("module integration failure"), true);

    const badRequest = await request(server, "/bad-request");
    await client.flush();
    assert.equal(badRequest.status, 400);
    assert.deepEqual(JSON.parse(badRequest.body), {
      error: "Bad Request",
      message: "module integration invalid input",
      statusCode: 400,
    });
    assert.equal(moduleAlerts.length, 2);

    const stringHttpException = await request(server, "/string-http-exception");
    await client.flush();
    assert.equal(stringHttpException.status, 418);
    assert.deepEqual(JSON.parse(stringHttpException.body), {
      message: "module string response",
      statusCode: 418,
    });
    assert.equal(moduleAlerts.length, 3);
  } finally {
    await app.close();
  }
});
