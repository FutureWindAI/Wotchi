# Wotchi Express example

This example uses the packed Wotchi SDK with Express 5 and the console notifier. It is a small
consumer application for checking the public `/express` entry point.

Install dependencies, then start it:

```bash
npm install
npm start
```

The example listens on `http://127.0.0.1:3101`. Trigger a grouped alert with:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3101/repeat-error; done
```

Other endpoints are `/success`, `/error`, `/secret-error`, and `/spike`. Three matching
`/repeat-error` requests should produce one grouped `Wotchi` console alert while each request still
receives the example's normal `500` response.

The final error handler remains responsible for the HTTP response. Wotchi observes the error and
queues its console notification without changing Express response ownership. See the [examples
index](../../docs/EXAMPLES.md) for the expected behavior and [configuration](../../docs/CONFIGURATION.md)
for grouping defaults.
