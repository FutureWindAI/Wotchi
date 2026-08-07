export interface RollingWindowOptions {
  maxEvents: number;
  windowMs: number;
  now?: () => number;
}

export interface RollingWindow {
  add(timestamp?: number): void;
  count(timestamp?: number): number;
  size(timestamp?: number): number;
  timestamps(timestamp?: number): readonly number[];
}

export function createRollingWindow(options: RollingWindowOptions): RollingWindow {
  if (!Number.isSafeInteger(options.maxEvents) || options.maxEvents <= 0) {
    throw new RangeError("maxEvents must be a positive integer");
  }
  if (!Number.isSafeInteger(options.windowMs) || options.windowMs <= 0) {
    throw new RangeError("windowMs must be a positive integer");
  }

  const now = options.now ?? Date.now;
  const buffer = new Array<number>(options.maxEvents);
  let head = 0;
  let length = 0;

  const readNow = (timestamp?: number): number => {
    const value = timestamp ?? now();
    return Number.isFinite(value) ? value : now();
  };

  const purge = (timestamp: number): void => {
    while (length > 0) {
      const oldest = buffer[head];
      if (oldest === undefined || timestamp - oldest < options.windowMs) {
        break;
      }
      buffer[head] = undefined as never;
      head = (head + 1) % options.maxEvents;
      length -= 1;
    }
  };

  const add = (timestamp?: number): void => {
    const value = readNow(timestamp);
    purge(value);
    const index = (head + length) % options.maxEvents;
    if (length === options.maxEvents) {
      buffer[head] = undefined as never;
      head = (head + 1) % options.maxEvents;
      length -= 1;
    }
    buffer[index] = value;
    length += 1;
  };

  const timestamps = (timestamp?: number): readonly number[] => {
    const value = readNow(timestamp);
    purge(value);
    const result: number[] = [];
    for (let index = 0; index < length; index += 1) {
      const entry = buffer[(head + index) % options.maxEvents];
      if (entry !== undefined) {
        result.push(entry);
      }
    }
    return result;
  };

  return {
    add,
    count: (timestamp?: number) => timestamps(timestamp).length,
    size: (timestamp?: number) => timestamps(timestamp).length,
    timestamps,
  };
}
