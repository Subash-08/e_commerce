import { identifier, integer, requireFact } from "./errors";
export interface TransitionContext {
  readonly operationId: string;
  readonly expectedRevision: number;
  readonly actorId: string;
  readonly reason: string;
  readonly at: number;
  /** A trusted service must establish permission; never copy this from browser input. */
  readonly authorized: boolean;
}
export interface AuditEntry {
  readonly transitions?: readonly { readonly from: string; readonly to: string }[];
  readonly operationId: string;
  readonly actorId: string;
  readonly reason: string;
  readonly at: number;
  readonly fingerprint: string;
}
export interface Versioned {
  readonly revision: number;
  readonly history: readonly AuditEntry[];
}
function canonical(value: unknown): string {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function auditTransition(
  record: Versioned,
  context: TransitionContext,
  command: unknown,
): AuditEntry | null {
  identifier(context.operationId);
  identifier(context.actorId);
  identifier(context.reason);
  integer(context.at);
  integer(context.expectedRevision);
  integer(record.revision, 0, Number.MAX_SAFE_INTEGER - 1);
  requireFact(context.authorized === true, "FORBIDDEN");
  const fingerprint = canonical({
    command,
    actorId: context.actorId,
    reason: context.reason,
  });
  const previous = record.history.find(
    (e) => e.operationId === context.operationId,
  );
  if (previous) {
    requireFact(previous.fingerprint === fingerprint, "IDEMPOTENCY_CONFLICT");
    return null;
  }
  requireFact(
    record.revision === context.expectedRevision,
    "REVISION_CONFLICT",
  );
  requireFact(
    record.history.every((e) => e.at <= context.at),
    "STALE_EVENT_TIME",
  );
  return {
    operationId: context.operationId,
    actorId: context.actorId,
    reason: context.reason,
    at: context.at,
    fingerprint,
  };
}
export function advance(record: Versioned, entry: AuditEntry, transitions: NonNullable<AuditEntry["transitions"]> = []): Versioned {
  return { revision: record.revision + 1, history: [...record.history, { ...entry, transitions }] };
}
