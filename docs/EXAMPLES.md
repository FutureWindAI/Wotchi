# Examples

The Express and NestJS examples use the packed Wotchi package and console delivery. The production
recipe at the end of this document uses the current beta APIs and remains separate from the
published beta examples and local-only compatibility fixtures.

## Express 5

Path: [`examples/express`](../examples/express)

```bash
cd examples/express
npm install
npm start
```

The server listens on `http://127.0.0.1:3101`.

| Endpoint            | Expected result                                                |
| ------------------- | -------------------------------------------------------------- |
| `GET /success`      | `200` JSON response.                                           |
| `GET /error`        | `500` response from the example's final error handler.         |
| `GET /repeat-error` | `500` response; three calls produce one grouped console alert. |
| `GET /secret-error` | `500` response; the sample secret is redacted from the alert.  |
| `GET /spike`        | `200` readiness response.                                      |

Trigger the grouped alert:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3101/repeat-error; done
```

The Wotchi handler observes the error and calls the existing Express error path exactly once.

## NestJS 11

Path: [`examples/nest`](../examples/nest)

```bash
cd examples/nest
npm install
npm start
```

The server listens on `http://127.0.0.1:3102`.

| Endpoint            | Expected result                                                |
| ------------------- | -------------------------------------------------------------- |
| `GET /success`      | `200` JSON response.                                           |
| `GET /error`        | NestJS error response.                                         |
| `GET /repeat-error` | Error response; three calls produce one grouped console alert. |
| `GET /secret-error` | Error response; the sample secret is redacted from the alert.  |
| `GET /spike`        | `200` readiness response.                                      |

Trigger the grouped alert:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3102/repeat-error; done
```

The global Wotchi filter delegates to NestJS, so NestJS keeps control of the response body and
status code.

## Manual capture

The root package also supports framework-independent capture. Use the [getting-started example](GETTING_STARTED.md#2-create-a-client)
when a service needs an explicit boundary instead of framework middleware.

See the [API reference](API.md) for public imports and [configuration](CONFIGURATION.md) for
grouping and notifier defaults.

## Background workers and queues

Wotchi can observe failures in queue processors, cron jobs, and other non-HTTP code through
`captureException`. Keep the host worker's retry and acknowledgement flow unchanged:

```ts
async function processJob(job: { type: string }) {
  try {
    await executeJob(job);
  } catch (error) {
    wotchi.captureException(error, {
      operation: "orders.process-job",
      jobType: job.type,
    });
    throw error;
  }
}
```

Wotchi records a bounded, sanitized incident and returns immediately. It does not acknowledge
the job, schedule retries, or store the payload. Avoid putting full job payloads, credentials, or
customer data in the context. Use `await wotchi.flush()` only when the process is intentionally
shutting down and pending notifier delivery must be drained.

## Production recipe

See [`examples/production-recipe`](../examples/production-recipe) for an Express 5 service that
combines:

- `/healthz` for an external uptime monitor;
- console delivery plus an optional bounded HTTPS webhook;
- explicit release and instance labels;
- graceful `SIGTERM`/`SIGINT` shutdown with `wotchi.flush(3_000)`.

The recipe fits Render, Railway, or Cloud Run, but it does not replace platform health checks or
external uptime monitoring. Wotchi runs inside one process: replicas have independent grouping
state, restarts reset cooldowns, and serverless termination can interrupt asynchronous delivery.
