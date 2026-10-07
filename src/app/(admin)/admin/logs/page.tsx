import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getIdentity } from "@/modules/identity/runtime";
export default async function AuditPage() {
  const requestHeaders = new Headers(await headers());
  const identity = await getIdentity();
  try {
    await identity.requireAccess(requestHeaders, "audit.read");
  } catch {
    redirect("/login");
  }
  const entries = await identity.administration.auditTrail(requestHeaders);
  const labels: Record<string, string> = {
    FIRST_ADMIN_BOOTSTRAPPED: "Administrator created",
    USER_ROLE_CHANGED: "Role changed",
    USER_DEACTIVATED: "Account disabled",
    USER_ACTIVATED: "Account enabled",
    PASSWORD_RESET: "Password reset",
    SESSION_REVOCATION_RETRY: "Session cleanup retried",
    PROFILE_RECOVERED: "Customer profile recovered",
  };
  return (
    <section data-feature="audit">
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">Security & accountability</span>
          <h1>Audit trail</h1>
          <p>
            The 50 most recent account security events. Credentials are never
            stored here.
          </p>
        </div>
      </div>
      <div className="admin-panel">
        {entries.length === 0 ? (
          <div className="admin-empty">
            <h2>No security events yet</h2>
            <p>Account access changes will appear here.</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Account</th>
                  <th>Actor</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>
                        {labels[entry.action] ?? "Account security event"}
                      </strong>
                    </td>
                    <td>
                      <code>{entry.entityId}</code>
                    </td>
                    <td>
                      <code>{entry.actorId}</code>
                    </td>
                    <td>
                      {new Date(entry.occurredAt).toLocaleString("en-GB", {
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
