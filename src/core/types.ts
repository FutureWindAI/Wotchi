export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type WotchiEventKind = "error" | "manual" | "process-monitor" | "runtime-monitor";

export interface WotchiTraceContext {
  traceId?: string;
  spanId?: string;
}

export interface WotchiRequestContext extends Record<string, unknown> {
  method?: string;
  route?: string;
  statusCode?: number;
  requestId?: string;
  correlationId?: string;
  trace?: WotchiTraceContext;
}

export type WotchiTags = Readonly<Record<string, string>>;
export interface WotchiLinkTemplates {
  log?: string;
  trace?: string;
}
export interface WotchiLinks {
  log?: string;
  trace?: string;
}

export type WotchiFingerprintCallback = (event: Readonly<SafeErrorEvent>) => string | undefined;

export type WotchiFingerprintOverride = string | WotchiFingerprintCallback;

export type WotchiEventFilter = (event: Readonly<SafeErrorEvent>) => boolean;

export type WotchiBeforeSend = (alert: Readonly<IncidentAlert>) => IncidentAlert | null | undefined;

export interface WotchiCaptureOptions {
  fingerprint?: WotchiFingerprintOverride;
  severity?: IncidentSeverity;
  alertThreshold?: number;
  request?: WotchiRequestContext;
  trace?: WotchiTraceContext;
  correlationId?: string;
  operation?: string;
  job?: string;
  tags?: Record<string, unknown>;
}

export interface WotchiEventInput {
  level: "error";
  kind?: WotchiEventKind;
  message: string;
  error?: unknown;
  alertThreshold?: number;
  severity?: IncidentSeverity;
  fingerprint?: WotchiFingerprintOverride;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
  request?: WotchiRequestContext;
  trace?: WotchiTraceContext;
  correlationId?: string;
  operation?: string;
  job?: string;
  tags?: Record<string, unknown>;
}

export interface SafeErrorEvent {
  id: string;
  timestamp: string;
  service: string;
  environment: string;
  instance?: string;
  release?: string;
  correlationId?: string;
  operation?: string;
  job?: string;
  tags?: WotchiTags;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  request?: WotchiRequestContext;
  trace?: WotchiTraceContext;
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
  instance?: string;
  release?: string;
  correlationId?: string;
  operation?: string;
  job?: string;
  tags?: WotchiTags;
  error?: SafeErrorEvent["error"] & { applicationFrame?: string };
  request?: WotchiRequestContext;
  trace?: WotchiTraceContext;
  context?: Record<string, unknown>;
  links?: WotchiLinks;
}

export interface WotchiNotifier {
  readonly name: string;
  send(alert: IncidentAlert): Promise<void>;
}

export interface ConsoleNotifierOptions {
  write?: (line: string) => void;
  format?: "text" | "json";
}

export interface TelegramNotifierOptions {
  botToken: string;
  chatId: string;
  timeoutMs?: number;
}

export interface WebhookNotifierOptions {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  allowHttpLoopback?: boolean;
  allowPrivateDestinations?: boolean;
  payloadBuilder?: (alert: Readonly<IncidentAlert>) => unknown;
}

export interface WotchiIncidentRule {
  environment?: string;
  route?: string;
  ignore?: boolean;
  alertThreshold?: number;
  severity?: IncidentSeverity;
}

export interface WotchiConfig {
  service: string;
  environment: string;
  instance?: string;
  release?: string;
  enabled?: boolean;
  filter?: WotchiEventFilter;
  fingerprint?: WotchiFingerprintCallback;
  beforeSend?: WotchiBeforeSend;
  links?: WotchiLinkTemplates;
  rules?: readonly WotchiIncidentRule[];
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
    notifierTimeoutMs?: number;
    notifierCircuitBreaker?: {
      failureThreshold?: number;
      cooldownMs?: number;
    };
  };
  overload?: {
    maxEventsPerSecond?: number;
    burst?: number;
    alertCooldownMs?: number;
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
  fingerprintCallbackFailures: number;
  filterFailures: number;
  beforeSendFailures: number;
  eventsSuppressed: number;
  eventsDroppedOverload: number;
  capturesAfterShutdown: number;
  activeGroups: number;
  pendingAlerts: number;
  notifierTimeouts: number;
  notifierCircuitOpenSkips: number;
}

export type WotchiTestAlertStatus = "sent" | "queue-full" | "timeout" | "notifier-failed";

export interface WotchiTestAlertResult {
  status: WotchiTestAlertStatus;
  configurationAccepted: true;
  queued: boolean;
  flushed: boolean;
  delivered: boolean;
  notifierFailures: number;
  diagnostics: Readonly<WotchiDiagnostics>;
  error?: string;
}

export interface WotchiClient {
  captureException(
    error: unknown,
    context?: Record<string, unknown>,
    options?: WotchiCaptureOptions,
  ): void;
  captureEvent(event: WotchiEventInput): void;
  testAlert(): Promise<WotchiTestAlertResult>;
  flush(timeoutMs?: number): Promise<void>;
  shutdown(timeoutMs?: number): Promise<void>;
  getDiagnostics(): Readonly<WotchiDiagnostics>;
}
