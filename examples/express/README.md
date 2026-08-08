# Wotchi Express example

This example uses the packed Wotchi SDK with Express 5 and the console notifier.

Install dependencies, then start it:

```bash
npm install
npm start
```

The example listens on `http://127.0.0.1:3101`. Trigger a grouped alert with:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3101/repeat-error; done
```

The final error handler remains responsible for the HTTP response. Wotchi observes the error and
queues its console notification without changing Express response ownership.
