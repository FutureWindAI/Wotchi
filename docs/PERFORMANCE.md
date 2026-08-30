# Wotchi performance evidence

The benchmark targets are capture p95 `<1 ms`, capture p99 `<2 ms`, duplicate-storm heap delta `<10 MiB`, unique-storm heap delta `<20 MiB`, and a packed tarball `<=150 KB`.

Run the reproducible local benchmark after a build:

```bash
npm run benchmark
npm run benchmark:queue
```

The benchmark uses Node's built-in `perf_hooks`, runs latency and heap scenarios in one process, and requires `--expose-gc` for the heap gates. The queue benchmark holds a notifier unresolved, admits 101 alerts, drops overflow, and checks that Express and NestJS responses complete while notification work is blocked. It is a release signal, not a universal production-performance guarantee; results depend on runtime, hardware, and workload.

## Latest release-candidate result

Recorded for `1.0.0-rc.1` on 2026-08-30, macOS arm64, Node.js `v22.14.0`:

| Measurement                                     |         Result |              Gate |
| ----------------------------------------------- | -------------: | ----------------: |
| Capture p95                                     |    `0.0354 ms` |           `<1 ms` |
| Capture p99                                     |    `0.0354 ms` |           `<2 ms` |
| Duplicate heap delta, 10,000 events             |    `0.183 MiB` |         `<10 MiB` |
| Unique heap delta, 1,000 events, max 200 groups |    `0.101 MiB` |         `<20 MiB` |
| Prometheus render p95, 100 renders              |    `0.0057 ms` |           `<1 ms` |
| Packed npm tarball                              | `60,820 bytes` | `<=153,600 bytes` |

These measurements are one reference run, not a production guarantee. Repeat them on the target
runtime and workload before making performance claims.

## Queue saturation result

Recorded for `1.0.0-rc.1` on 2026-08-30, macOS arm64, Node.js `v22.14.0`, with localhost binding enabled:

| Check                                                 | Result        |
| ----------------------------------------------------- | ------------- |
| Pending queue limit under 250 eligible events         | `100` maximum |
| Alerts admitted while first notifier remained blocked | `101`         |
| Overflow alerts dropped                               | `149`         |
| Express response while notifier blocked               | passed        |
| NestJS response while notifier blocked                | passed        |

The benchmark confirms that notification delivery is outside the framework response path and that pending work remains bounded. It does not guarantee that the host application's other work is inexpensive under arbitrary load.

## Local adversarial validation

The bounded implementation has also been exercised with high-frequency duplicates, 50,000 unique errors with
the hard `maxGroups: 10,000` setting, 10 MiB synthetic stacks, a blocked notifier, slow/failing
notifiers, cyclic/proxy inputs, credential-shaped URLs, short JWT-like values, and two independent
application instances. The bounded queue and grouping state remained within their configured caps,
no collected alert output contained the injected secret markers, and host HTTP capture remained
non-blocking. The deliberately adversarial `maxGroups: 10,000` run used about `23 MiB` retained heap
after garbage collection and about `150 MiB` RSS high-water growth; this is configuration/input
pressure, not the default `maxGroups: 200` baseline. Custom notifier promises that never settle can
hold the single delivery worker, so built-in transport timeouts and graceful shutdown remain
important. Wotchi bounds arbitrary notifier waits with a queue-level timeout and
failure circuit; the unresolved custom promise itself cannot be cancelled. The optional runtime
watcher is disabled by default and uses one unref'd low-frequency timer; benchmark enabled thresholds
in the host workload before production use. Cross-instance grouping is intentionally not provided
by the in-process SDK.
