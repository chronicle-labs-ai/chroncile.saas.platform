export interface AppendAuditLogParams {
  tenantId: string;
  runId?: string;
  eventId?: string;
  invocationId?: string;
  action: string;
  actor?: string;
  payload?: Record<string, unknown>;
}

export async function appendAuditLog(
  _params: AppendAuditLogParams
): Promise<void> {
  // Audit logging is handled by Rust backend handlers
}
