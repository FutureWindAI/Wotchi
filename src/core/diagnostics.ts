import type { WotchiDiagnostics } from "./types.js";

export interface DiagnosticsState {
  capturedEvents: number;
  captureFailures: number;
}

export function createDiagnosticsState(): DiagnosticsState {
  return { capturedEvents: 0, captureFailures: 0 };
}

export function snapshotDiagnostics(
  state: DiagnosticsState,
  values: Omit<WotchiDiagnostics, "capturedEvents" | "captureFailures">,
): Readonly<WotchiDiagnostics> {
  return Object.freeze({
    capturedEvents: state.capturedEvents,
    captureFailures: state.captureFailures,
    ...values,
  });
}
