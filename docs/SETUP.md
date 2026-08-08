# Wotchi setup

Wotchi is a framework-independent Node.js SDK. It observes application errors, groups repeated
events in bounded memory, and sends sanitized incident alerts to the configured notifiers.

## Requirements

- Node.js `18.18.0` or later
- An Express 4/5 or NestJS 10/11 application when using a framework adapter
- No database, collector, account, or AI provider for the MVP

## Install

```bash
npm install @futurewindai/wotchi
```

Install the framework separately when needed:

```bash
npm install express
# or
npm install @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs
```

The framework packages are optional peers. A console-only core consumer does not need Express or
NestJS installed.

## Express

Register the observer after the application's routes and before its existing final error handler:

```ts
import express from "express";
import { consoleNotifier, createWotchi } from "@futurewindai/wotchi";
import { wotchiErrorHandler } from "@futurewindai/wotchi/express";

const app = express();
const wotchi = createWotchi({
  service: "orders-api",
  environment: process.env.NODE_ENV ?? "development",
  notifiers: [consoleNotifier()],
});

app.get("/health", (_request, response) => response.json({ status: "ok" }));
// Register application routes here.
app.use(wotchiErrorHandler(wotchi));
// Keep the application's existing final error handler after Wotchi.
```

## NestJS

Register the delegating global filter once after creating the Nest application:

```ts
import { NestFactory } from "@nestjs/core";
import { createWotchi, consoleNotifier } from "@futurewindai/wotchi";
import { registerWotchiNest } from "@futurewindai/wotchi/nest";

const app = await NestFactory.create(AppModule);
const wotchi = createWotchi({
  service: "orders-api",
  environment: process.env.NODE_ENV ?? "development",
  notifiers: [consoleNotifier()],
});
registerWotchiNest(app, wotchi);
await app.listen(3000);
```

## Local examples

The public examples use the package version declared in their manifests. From an example folder:

```bash
npm install
npm start
```

For local development before the package is published, build Wotchi and install the generated
tarball in the example instead:

```bash
cd ../..
npm run build
npm pack --pack-destination /tmp/wotchi-example
cd examples/express
npm install /tmp/wotchi-example/futurewindai-wotchi-0.1.0-beta.1.tgz
npm start
```

See [Testing](TESTING.md) for the complete clean-tarball and smoke workflow.
