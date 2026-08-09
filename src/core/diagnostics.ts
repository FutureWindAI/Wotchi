import type { WotchiDiagnostics } from "./types.js";

export interface DiagnosticsState {
  capturedEvents: number;
  captureFailures: number;
  fingerprintCallbackFailures: number;
  filterFailures: number;
  beforeSendFailures: number;
  eventsSuppressed: number;
}

export function createDiagnosticsState(): DiagnosticsState {
  return {
    capturedEvents: 0,
    captureFailures: 0,
    fingerprintCallbackFailures: 0,
    filterFailures: 0,
    beforeSendFailures: 0,
    eventsSuppressed: 0,
  };
}

export function snapshotDiagnostics(
  state: DiagnosticsState,
  values: Omit<
    WotchiDiagnostics,
    | "capturedEvents"
    | "captureFailures"
    | "fingerprintCallbackFailures"
    | "filterFailures"
    | "beforeSendFailures"
    | "eventsSuppressed"
  >,
): Readonly<WotchiDiagnostics> {
  return Object.freeze({
    capturedEvents: state.capturedEvents,
    captureFailures: state.captureFailures,
    fingerprintCallbackFailures: state.fingerprintCallbackFailures,
    filterFailures: state.filterFailures,
    beforeSendFailures: state.beforeSendFailures,
    eventsSuppressed: state.eventsSuppressed,
    ...values,
  });
}
