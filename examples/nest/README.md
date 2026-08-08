# Wotchi NestJS example

This example uses the packed Wotchi SDK with NestJS 11 and the console notifier.

Install dependencies, then start it:

```bash
npm install
npm start
```

The example listens on `http://127.0.0.1:3102`. Trigger a grouped alert with:

```bash
for i in 1 2 3; do curl -sS -i http://127.0.0.1:3102/repeat-error; done
```

Wotchi is registered as a global exception observer. NestJS remains responsible for the response
body and status code.
