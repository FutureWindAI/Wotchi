# Wotchi

> Your production's night shift.

Wotchi is a planned lightweight incident assistant for Node.js applications. It is intended to help small teams turn repeated Express and NestJS application errors into a small number of useful console or Telegram alerts without operating a separate monitoring stack.

> **Project status:** planning and repository setup. No Wotchi npm version is available yet, and no package implementation is present in this repository.

The working package name is `/wotchi`. Product-name, trademark, and competing-product clearance must be completed before the first public package release. Do not install similarly named packages expecting this project.

## Planned v0.1 Scope

- one framework-independent TypeScript core;
- focused integrations for Express 4/5 and NestJS 10/11;
- manual exception and structured error-event capture;
- sensitive-data redaction before storage, fingerprinting, logging, or transmission;
- stable fingerprints and deterministic incident summaries;
- bounded in-memory grouping, thresholds, cooldowns, and notification queueing;
- console and Telegram notifiers;
- CommonJS and ECMAScript module package exports;
- measured latency, CPU, heap, queue, and package-size release gates.

The planned package will expose a root entry point plus focused `/express` and `/nest` entry points. Exact API examples and installation instructions will be published only after the package exists and its compatibility tests pass.

## Product Principles

- **Host safety:** Wotchi must not break, suppress, or materially delay the application's normal error flow.
- **Bounded overhead:** memory, payloads, groups, and queued notifications must all have explicit limits.
- **Privacy first:** request bodies, response bodies, raw headers, and arbitrary environment variables are outside the first release.
- **Deterministic first:** the MVP must work without an AI provider, database, hosted account, or collector.
- **Honest compatibility:** the project intends to test Node.js 16.20 and later, but support will be claimed only for combinations verified before release. Maintained Node.js LTS versions will be recommended for production.

## Not Planned for v0.1

- a full observability, APM, or log-management platform;
- a hosted dashboard, collector, or persistent incident history;
- AI-generated summaries;
- Slack, Discord, email, or generic webhook notifiers;
- logger transports, Docker collectors, Kubernetes agents, or Helm charts;
- automatic remediation.

A token-based hosted demo viewer is a separate possible future milestone, not part of the package MVP.

## Project Documents

- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Apache License 2.0](LICENSE)

Wotchi is an early open-source project from FutureWind AI. Contributions and product feedback should stay within the documented scope and avoid real secrets or customer error data.
