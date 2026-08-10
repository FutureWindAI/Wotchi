import type { WotchiClient, WotchiDiagnostics } from "./types.js";

export const PROMETHEUS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

export interface WotchiPrometheusExporter {
  readonly contentType: typeof PROMETHEUS_CONTENT_TYPE;
  render(): string;
}

type DiagnosticCounter = {
  readonly name: string;
  readonly help: string;
  readonly type: "counter" | "gauge";
  readonly value: (diagnostics: WotchiDiagnostics) => number;
};

const METRICS: readonly DiagnosticCounter[] = [
  {
    name: "captured_events_total",
    help: "Total events accepted by Wotchi.",
    type: "counter",
    value: (diagnostics) => diagnostics.capturedEvents,
  },
  {
    name: "capture_failures_total",
    help: "Capture failures contained by Wotchi.",
    type: "counter",
    value: (diagnostics) => diagnostics.captureFailures,
  },
  {
    name: "groups_evicted_total",
    help: "Groups evicted from bounded memory.",
    type: "counter",
    value: (diagnostics) => diagnostics.groupsEvicted,
  },
  {
    name: "alerts_queued_total",
    help: "Alerts admitted to the notification queue.",
    type: "counter",
    value: (diagnostics) => diagnostics.alertsQueued,
  },
  {
    name: "alerts_dropped_total",
    help: "Alerts dropped because the notification queue was full.",
    type: "counter",
    value: (diagnostics) => diagnostics.alertsDropped,
  },
  {
    name: "alerts_sent_total",
    help: "Alerts delivered successfully to notifiers.",
    type: "counter",
    value: (diagnostics) => diagnostics.alertsSent,
  },
  {
    name: "notifier_failures_total",
    help: "Notifier delivery failures contained by Wotchi.",
    type: "counter",
    value: (diagnostics) => diagnostics.notifierFailures,
  },
  {
    name: "fingerprint_callback_failures_total",
    help: "Fingerprint callback failures contained by Wotchi.",
    type: "counter",
    value: (diagnostics) => diagnostics.fingerprintCallbackFailures,
  },
  {
    name: "filter_failures_total",
    help: "Event filter failures contained by Wotchi.",
    type: "counter",
    value: (diagnostics) => diagnostics.filterFailures,
  },
  {
    name: "before_send_failures_total",
    help: "Before-send callback failures contained by Wotchi.",
    type: "counter",
    value: (diagnostics) => diagnostics.beforeSendFailures,
  },
  {
    name: "events_suppressed_total",
    help: "Events suppressed by filtering, thresholds, or cooldowns.",
    type: "counter",
    value: (diagnostics) => diagnostics.eventsSuppressed,
  },
  {
    name: "events_dropped_overload_total",
    help: "Events dropped before normalization by the optional overload admission limit.",
    type: "counter",
    value: (diagnostics) => diagnostics.eventsDroppedOverload,
  },
  {
    name: "captures_after_shutdown_total",
    help: "Capture calls ignored after client shutdown.",
    type: "counter",
    value: (diagnostics) => diagnostics.capturesAfterShutdown,
  },
  {
    name: "notifier_timeouts_total",
    help: "Notifier deliveries that exceeded the configured timeout.",
    type: "counter",
    value: (diagnostics) => diagnostics.notifierTimeouts,
  },
  {
    name: "notifier_circuit_open_skips_total",
    help: "Notifier deliveries skipped while the notifier circuit was open.",
    type: "counter",
    value: (diagnostics) => diagnostics.notifierCircuitOpenSkips,
  },
  {
    name: "active_groups",
    help: "Current in-memory incident groups.",
    type: "gauge",
    value: (diagnostics) => diagnostics.activeGroups,
  },
  {
    name: "pending_alerts",
    help: "Current alerts waiting for notifier delivery.",
    type: "gauge",
    value: (diagnostics) => diagnostics.pendingAlerts,
  },
];

const safeMetricValue = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
};

const renderMetrics = (diagnostics: WotchiDiagnostics): string => {
  const lines: string[] = [];
  for (const metric of METRICS) {
    lines.push(
      `# HELP wotchi_${metric.name} ${metric.help}`,
      `# TYPE wotchi_${metric.name} ${metric.type}`,
      `wotchi_${metric.name} ${safeMetricValue(metric.value(diagnostics))}`,
    );
  }
  lines.push("");
  return lines.join("\n");
};

export function createWotchiPrometheusExporter(
  client: Pick<WotchiClient, "getDiagnostics">,
): WotchiPrometheusExporter {
  return Object.freeze({
    contentType: PROMETHEUS_CONTENT_TYPE,
    render: () => renderMetrics(client.getDiagnostics()),
  });
}
