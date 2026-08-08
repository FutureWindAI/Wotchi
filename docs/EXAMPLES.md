# Examples

The checked-in examples use the packed Wotchi package and console delivery. They are intentionally
small and separate from the local-only compatibility fixtures.

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
