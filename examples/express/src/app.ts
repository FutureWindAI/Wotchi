import express from "express";
import { consoleNotifier, createWotchi } from "@futurewindai/wotchi";
import { wotchiErrorHandler } from "@futurewindai/wotchi/express";

const app = express();
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "3101");
let repeatCount = 0;

const wotchi = createWotchi({
  service: "wotchi-express-example",
  environment: "local-example",
  notifiers: [consoleNotifier()],
});

app.get("/success", (_request, response) => {
  response.json({ status: "ok", framework: "express", version: "5.x" });
});

app.get("/error", () => {
  throw new Error("Express example error");
});

app.get("/repeat-error", () => {
  repeatCount += 1;
  throw new Error(`Express example repeated error #${repeatCount}`);
});

app.get("/secret-error", () => {
  throw new Error("Express example secret token=example-only-secret");
});

app.get("/spike", (_request, response) => {
  response.json({ status: "ok", message: "Express example is ready" });
});

app.use(wotchiErrorHandler(wotchi));
app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    response.status(500).json({
      error: error instanceof Error ? error.message : "error",
    });
  },
);

app.listen(port, host, () => {
  console.log(`Wotchi Express example listening on http://${host}:${port}`);
  console.log("Trigger /repeat-error three times to see one grouped console alert.");
});
