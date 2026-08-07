const INTERNAL_MARKERS = ["node_modules/", "node:internal/", "internal/"];

const isInternalFrame = (frame: string): boolean => {
  const lower = frame.toLowerCase();
  return INTERNAL_MARKERS.some((marker) => lower.includes(marker));
};

export function normalizeStackFrame(frame: string): string {
  return frame
    .trim()
    .replace(/^at\s+/, "")
    .replace(/:\d+:\d+(?=\)?$)/, "")
    .replace(/\s+/g, " ");
}

export function selectApplicationFrame(stack?: string): string | undefined {
  if (typeof stack !== "string" || stack.length === 0) {
    return undefined;
  }
  for (const line of stack.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^\w*Error(?::|$)/.test(trimmed)) {
      continue;
    }
    const frame = normalizeStackFrame(trimmed);
    if (!frame || isInternalFrame(frame)) {
      continue;
    }
    return frame;
  }
  return undefined;
}
