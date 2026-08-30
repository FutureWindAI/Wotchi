const capturedRequests = new WeakSet<object>();

const asRequestObject = (request: unknown): object | undefined =>
  typeof request === "object" && request !== null ? request : undefined;

export function markExpressErrorCaptured(request: unknown): void {
  const requestObject = asRequestObject(request);
  if (requestObject === undefined) {
    return;
  }
  capturedRequests.add(requestObject);
}

export function wasExpressErrorCaptured(request: unknown): boolean {
  const requestObject = asRequestObject(request);
  return requestObject === undefined ? false : capturedRequests.has(requestObject);
}
