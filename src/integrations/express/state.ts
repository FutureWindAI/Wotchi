const WOTCHI_ERROR_CAPTURED = Symbol("wotchi.errorCaptured");

type MarkedRequest = { [WOTCHI_ERROR_CAPTURED]?: boolean };

const asMarkedRequest = (request: unknown): MarkedRequest | undefined =>
  typeof request === "object" && request !== null ? (request as MarkedRequest) : undefined;

export function markExpressErrorCaptured(request: unknown): void {
  const markedRequest = asMarkedRequest(request);
  if (markedRequest === undefined) {
    return;
  }
  try {
    markedRequest[WOTCHI_ERROR_CAPTURED] = true;
  } catch {
    // A request object can be frozen by host middleware; the observer remains best-effort.
  }
}

export function wasExpressErrorCaptured(request: unknown): boolean {
  const markedRequest = asMarkedRequest(request);
  if (markedRequest === undefined) {
    return false;
  }
  try {
    return markedRequest[WOTCHI_ERROR_CAPTURED] === true;
  } catch {
    return false;
  }
}
