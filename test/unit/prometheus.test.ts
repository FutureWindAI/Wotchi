import assert from "node:assert/strict";
import test from "node:test";
import { createWotchiPrometheusExporter } from "../../src/index.js";
import type { WotchiDiagnostics } from "../../src/index.js";

const diagnostics: WotchiDiagnostics = {
  capturedEvents: 12,
  captureFailures: 1,
  groupsEvicted: 2,
  alertsQueued: 7,
  alertsDropped: 3,
  alertsSent: 5,
  notifierFailures: 1,
  fingerprintCallbackFailures: 0,
  filterFailures: 1,
  beforeSendFailures: 0,
  eventsSuppressed: 4,
  eventsDroppedOverload: 0,
  capturesAfterShutdown: 0,
  activeGroups: 6,
  pendingAlerts: 2,
  notifierTimeouts: 0,
  notifierCircuitOpenSkips: 0,
};

test("Prometheus exporter renders fixed aggregate counters and gauges", () => {
  const exporter = createWotchiPrometheusExporter({ getDiagnostics: () => diagnostics });

  assert.equal(exporter.contentType, "text/plain; version=0.0.4; charset=utf-8");
  assert.equal(
    exporter.render(),
    [
      "# HELP wotchi_captured_events_total Total events accepted by Wotchi.",
      "# TYPE wotchi_captured_events_total counter",
      "wotchi_captured_events_total 12",
      "# HELP wotchi_capture_failures_total Capture failures contained by Wotchi.",
      "# TYPE wotchi_capture_failures_total counter",
      "wotchi_capture_failures_total 1",
      "# HELP wotchi_groups_evicted_total Groups evicted from bounded memory.",
      "# TYPE wotchi_groups_evicted_total counter",
      "wotchi_groups_evicted_total 2",
      "# HELP wotchi_alerts_queued_total Alerts admitted to the notification queue.",
      "# TYPE wotchi_alerts_queued_total counter",
      "wotchi_alerts_queued_total 7",
      "# HELP wotchi_alerts_dropped_total Alerts dropped because the notification queue was full.",
      "# TYPE wotchi_alerts_dropped_total counter",
      "wotchi_alerts_dropped_total 3",
      "# HELP wotchi_alerts_sent_total Alerts delivered successfully to notifiers.",
      "# TYPE wotchi_alerts_sent_total counter",
      "wotchi_alerts_sent_total 5",
      "# HELP wotchi_notifier_failures_total Notifier delivery failures contained by Wotchi.",
      "# TYPE wotchi_notifier_failures_total counter",
      "wotchi_notifier_failures_total 1",
      "# HELP wotchi_fingerprint_callback_failures_total Fingerprint callback failures contained by Wotchi.",
      "# TYPE wotchi_fingerprint_callback_failures_total counter",
      "wotchi_fingerprint_callback_failures_total 0",
      "# HELP wotchi_filter_failures_total Event filter failures contained by Wotchi.",
      "# TYPE wotchi_filter_failures_total counter",
      "wotchi_filter_failures_total 1",
      "# HELP wotchi_before_send_failures_total Before-send callback failures contained by Wotchi.",
      "# TYPE wotchi_before_send_failures_total counter",
      "wotchi_before_send_failures_total 0",
      "# HELP wotchi_events_suppressed_total Events suppressed by filtering, thresholds, or cooldowns.",
      "# TYPE wotchi_events_suppressed_total counter",
      "wotchi_events_suppressed_total 4",
      "# HELP wotchi_events_dropped_overload_total Events dropped before normalization by the optional overload admission limit.",
      "# TYPE wotchi_events_dropped_overload_total counter",
      "wotchi_events_dropped_overload_total 0",
      "# HELP wotchi_captures_after_shutdown_total Capture calls ignored after client shutdown.",
      "# TYPE wotchi_captures_after_shutdown_total counter",
      "wotchi_captures_after_shutdown_total 0",
      "# HELP wotchi_notifier_timeouts_total Notifier deliveries that exceeded the configured timeout.",
      "# TYPE wotchi_notifier_timeouts_total counter",
      "wotchi_notifier_timeouts_total 0",
      "# HELP wotchi_notifier_circuit_open_skips_total Notifier deliveries skipped while the notifier circuit was open.",
      "# TYPE wotchi_notifier_circuit_open_skips_total counter",
      "wotchi_notifier_circuit_open_skips_total 0",
      "# HELP wotchi_active_groups Current in-memory incident groups.",
      "# TYPE wotchi_active_groups gauge",
      "wotchi_active_groups 6",
      "# HELP wotchi_pending_alerts Current alerts waiting for notifier delivery.",
      "# TYPE wotchi_pending_alerts gauge",
      "wotchi_pending_alerts 2",
      "",
    ].join("\n"),
  );
});

test("Prometheus exporter reads a fresh snapshot and exposes no event data", () => {
  let snapshot = { ...diagnostics, pendingAlerts: 0 };
  const exporter = createWotchiPrometheusExporter({ getDiagnostics: () => snapshot });

  snapshot = { ...snapshot, pendingAlerts: 4, capturedEvents: 13 };
  const output = exporter.render();

  assert.match(output, /wotchi_pending_alerts 4/);
  assert.match(output, /wotchi_captured_events_total 13/);
  assert.equal(output.includes("stack trace"), false);
  assert.equal(output.includes("request data"), false);
  assert.equal(output.includes("secret-value"), false);
  assert.equal(output.includes("database query failed"), false);
  assert.equal(output.includes("orders-api"), false);
});

test("Prometheus exporter clamps malformed diagnostic numbers", () => {
  const exporter = createWotchiPrometheusExporter({
    getDiagnostics: () =>
      ({
        ...diagnostics,
        capturedEvents: Number.NaN,
        alertsSent: Number.POSITIVE_INFINITY,
        pendingAlerts: -3,
      }) as WotchiDiagnostics,
  });

  const output = exporter.render();
  assert.match(output, /wotchi_captured_events_total 0/);
  assert.match(output, /wotchi_alerts_sent_total 0/);
  assert.match(output, /wotchi_pending_alerts 0/);
});
