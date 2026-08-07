export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type WotchiEventKind = "error" | "manual" | "process-monitor";

export interface WotchiRequestContext extends Record<string, unknown> {
  method?: string;
  route?: string;
  statusCode?: number;
  requestId?: string;
}

export interface WotchiEventInput {
  level: "error";
  kind?: WotchiEventKind;
  message: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
  request?: WotchiRequestContext;
}

export interface SafeErrorEvent {
  id: string;
  timestamp: string;
  service: string;
  environment: string;
  release?: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  request?: WotchiRequestContext;
  context?: Record<string, unknown>;
}

export interface IncidentGroup {
  fingerprint: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalCount: number;
  windowCount: number;
  sample: SafeErrorEvent;
  lastAlertedAt?: string;
  severity: IncidentSeverity;
}

export interface IncidentAlert {
  id: string;
  fingerprint: string;
  title: string;
  severity: IncidentSeverity;
  summary: string;
  suggestedActions: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  service: string;
  environment: string;
}

export interface WotchiNotifier {
  readonly name: string;
  send(alert: IncidentAlert): Promise<void>;
}

export interface ConsoleNotifierOptions {
  write?: (line: string) => void;
}

export interface TelegramNotifierOptions {
  botToken: string;
  chatId: string;
  timeoutMs?: number;
}

export interface WotchiConfig {
  service: string;
  environment: string;
  release?: string;
  enabled?: boolean;
  grouping?: {
    windowMs?: number;
    alertThreshold?: number;
    cooldownMs?: number;
    maxGroups?: number;
    maxEventsPerWindow?: number;
  };
  queue?: {
    maxPendingAlerts?: number;
    concurrency?: 1;
  };
  privacy?: {
    redactKeys?: string[];
    maxDepth?: number;
    maxKeys?: number;
    maxStringLength?: number;
    maxStackLength?: number;
  };
  notifiers: WotchiNotifier[];
}

export interface WotchiDiagnostics {
  capturedEvents: number;
  captureFailures: number;
  groupsEvicted: number;
  alertsQueued: number;
  alertsDropped: number;
  alertsSent: number;
  notifierFailures: number;
  activeGroups: number;
  pendingAlerts: number;
}

export interface WotchiClient {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  captureEvent(event: WotchiEventInput): void;
  flush(timeoutMs?: number): Promise<void>;
  getDiagnostics(): Readonly<WotchiDiagnostics>;
}
