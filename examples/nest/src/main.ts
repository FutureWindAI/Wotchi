import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "3102");

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(port, host);
  console.log(`Wotchi NestJS example listening on http://${host}:${port}`);
  console.log("Trigger /repeat-error three times to see one grouped console alert.");
};

void bootstrap().catch((error: unknown) => {
  console.error("NestJS example failed to start", error);
  process.exitCode = 1;
});
