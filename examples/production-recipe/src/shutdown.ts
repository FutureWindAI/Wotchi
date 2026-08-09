import type { Server } from "node:http";

interface ConnectionClosable {
  closeAllConnections?: () => void;
  closeIdleConnections?: () => void;
}

export const closeServerWithTimeout = (server: Server, timeoutMs: number): Promise<void> =>
  new Promise((resolve) => {
    const closableServer = server as Server & ConnectionClosable;
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(closeTimer);
      resolve();
    };
    const closeTimer = setTimeout(() => {
      closableServer.closeIdleConnections?.();
      closableServer.closeAllConnections?.();
      finish();
    }, timeoutMs);
    try {
      server.close(() => finish());
    } catch {
      finish();
    }
  });

export const drainNotifications = async (
  flush: (timeoutMs: number) => Promise<void>,
  timeoutMs: number,
  _onFailure: (message: string) => void,
): Promise<void> => {
  try {
    await flush(timeoutMs);
  } catch {
    try {
      _onFailure("Wotchi notification drain did not finish before shutdown timeout.");
    } catch {
      // Shutdown logging cannot be allowed to create another process-level failure.
    }
  }
};
