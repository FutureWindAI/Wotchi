# Wotchi performance evidence

The release gates are defined in the private product plan: capture p95 `<1 ms`, capture p99 `<2 ms`, duplicate-storm heap delta `<10 MiB`, unique-storm heap delta `<20 MiB`, and packed tarball `<=150 KB`.

Run the reproducible local benchmark after a build:

```bash
npm run benchmark
npm run benchmark:queue
```

The benchmark uses Node's built-in `perf_hooks`, runs latency and heap scenarios in one process, and requires `--expose-gc` for the heap gates. The queue benchmark holds a notifier unresolved, admits 101 alerts, drops overflow, and checks that Express and NestJS responses complete while notification work is blocked. It is a release signal, not a universal production-performance guarantee; results depend on runtime, hardware, and workload.

## Latest local result

Recorded 2026-08-07 on macOS arm64, Node.js `v22.14.0`:

| Measurement                                     |         Result |              Gate |
| ----------------------------------------------- | -------------: | ----------------: |
| Capture p95                                     |    `0.0275 ms` |           `<1 ms` |
| Capture p99                                     |    `0.0275 ms` |           `<2 ms` |
| Duplicate heap delta, 10,000 events             |    `0.171 MiB` |         `<10 MiB` |
| Unique heap delta, 1,000 events, max 200 groups |    `0.073 MiB` |         `<20 MiB` |
| Packed npm tarball                              | `28,460 bytes` | `<=153,600 bytes` |

These measurements are local evidence for this candidate build. Repeat them on the release runtime and CI hardware before making performance claims.

## Queue saturation result

Recorded 2026-08-07 on macOS arm64, Node.js `v22.14.0`, with localhost binding enabled:

| Check                                                 | Result        |
| ----------------------------------------------------- | ------------- |
| Pending queue limit under 250 eligible events         | `100` maximum |
| Alerts admitted while first notifier remained blocked | `101`         |
| Overflow alerts dropped                               | `149`         |
| Express response while notifier blocked               | passed        |
| NestJS response while notifier blocked                | passed        |

The benchmark confirms that notification delivery is outside the framework response path and that pending work remains bounded. It does not guarantee that the host application's other work is inexpensive under arbitrary load.
