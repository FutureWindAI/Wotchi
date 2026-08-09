# Wotchi production recipe

This is a small Express 5 deployment shape for Render, Railway, Cloud Run, or a similar platform.
It targets the current `@futurewindai/wotchi@0.1.0-beta.5` beta package. Build the package from
the repository root before installing this recipe.

It demonstrates:

- `/healthz` for an external uptime monitor;
- console delivery by default and an optional bounded HTTPS webhook;
- explicit service, environment, release, and instance labels;
- graceful shutdown that closes the server and drains queued notifications;
- Wotchi observing the error while the host owns the HTTP response.

Install and run locally:

```bash
cd ../..
npm install
npm run build
cd examples/production-recipe
npm install
WOTCHI_SERVICE=orders-api WOTCHI_ENVIRONMENT=local npm start
```

Optional webhook configuration:

```bash
WOTCHI_WEBHOOK_URL=https://hooks.example.test/wotchi \
WOTCHI_WEBHOOK_AUTH='Bearer replace-me' \
WOTCHI_SERVICE=orders-api \
WOTCHI_ENVIRONMENT=production \
npm start
```

Configure the platform health check to call `/healthz`. The endpoint should be monitored by an
external uptime service because an in-process SDK cannot observe an OOM kill, a frozen event loop,
or a network outage that prevents delivery. This fixture is a recipe, not a completed deployment;
cloud credentials, service settings, and endpoint ownership remain application-specific.
