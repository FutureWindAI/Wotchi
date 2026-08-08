# Getting started

This guide takes about five minutes and uses console delivery only. No account, database,
collector, or external service is required.

## 1. Install the public beta

Use a supported Node.js release (`>=18.18.0`):

```bash
npm install @futurewindai/wotchi@beta
```

## 2. Create a client

Create `wotchi-smoke.mjs`:

```js
import { consoleNotifier, createWotchi } from "@futurewindai/wotchi";

const wotchi = createWotchi({
  service: "orders-api",
  environment: "local",
  grouping: { alertThreshold: 1 },
  notifiers: [consoleNotifier()],
});

wotchi.captureException(new Error("synthetic database failure"));
await wotchi.flush();
```

Run it:

```bash
node wotchi-smoke.mjs
```

The console output contains one sanitized incident alert. The threshold is set to one only to
make this first check immediate; the default policy groups three matching errors in one minute.

## 3. Attach an Express adapter

Install Express separately, then place Wotchi after routes and before the application's existing
final error handler:

```ts
import express from "express";
import { consoleNotifier, createWotchi } from "@futurewindai/wotchi";
import { wotchiErrorHandler } from "@futurewindai/wotchi/express";

const app = express();
const wotchi = createWotchi({
  service: "orders-api",
  environment: "local",
  notifiers: [consoleNotifier()],
});

app.get("/failure", () => {
  throw new Error("synthetic Express failure");
});

app.use(wotchiErrorHandler(wotchi));
app.use((error, _request, response, _next) => {
  response.status(500).json({ error: error.message });
});

app.listen(3000, "127.0.0.1");
```

Trigger three matching failures and inspect the console:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3000/failure; done
```

You should receive the normal HTTP error response and one grouped `Wotchi` alert. Wotchi does not
take ownership of the response.

## 4. Attach a NestJS adapter

For NestJS, create the client after `NestFactory.create()` and register it once:

```ts
const app = await NestFactory.create(AppModule);
const wotchi = createWotchi({
  service: "orders-api",
  environment: "local",
  notifiers: [consoleNotifier()],
});

registerWotchiNest(app, wotchi);
```

See the [NestJS example](EXAMPLES.md#nestjs-11) for a runnable application and trigger command.

## 5. Choose the next guide

- [Configuration](CONFIGURATION.md) for thresholds, cooldowns, privacy, and Telegram.
- [API reference](API.md) for public imports and method contracts.
- [Troubleshooting](TROUBLESHOOTING.md) if an expected alert does not appear.

Continue with the [Express or NestJS example](EXAMPLES.md), then review the [security boundary](SECURITY.md).
