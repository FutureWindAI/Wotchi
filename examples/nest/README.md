# Wotchi NestJS example

This example uses the packed Wotchi SDK with NestJS 11 and the console notifier. It is a small
consumer application for checking the public `/nest` entry point.

Install dependencies, then start it:

```bash
npm install
npm start
```

The example listens on `http://127.0.0.1:3102`. Trigger a grouped alert with:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3102/repeat-error; done
```

Other endpoints are `/success`, `/error`, `/secret-error`, and `/spike`. Three matching
`/repeat-error` requests should produce one grouped `Wotchi` console alert while NestJS continues to
own the error response.

Wotchi is registered as a global exception observer. NestJS remains responsible for the response
body and status code. See the [examples index](../../docs/EXAMPLES.md) and [configuration](../../docs/CONFIGURATION.md)
for the expected behavior and grouping defaults.
