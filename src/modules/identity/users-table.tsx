"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeUserAuthority, retryUserRevocations } from "./admin-actions";
import { authorityInput } from "./admin-validation";
import { stateValues } from "@/shared/domain/states.generated";
export interface UserRow {
  authUserId: string;
  name?: string;
  role: string;
  status: string;
  revision: number;
  createdAt: string;
  email?: string;
  lastLoginAt?: string;
}
export function UsersTable({
  rows,
  pendingRevocations,
}: {
  rows: UserRow[];
  pendingRevocations: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  function save(form: FormData) {
    if (!editing) return;
    const parsed = authorityInput.safeParse({
      authUserId: editing.authUserId,
      revision: editing.revision,
      role: form.get("role"),
      status: form.get("status"),
    });
    if (!parsed.success) {
      setNotice({
        ok: false,
        message: "Choose a valid role and account status.",
      });
      return;
    }
    if (
      (parsed.data.role !== editing.role ||
        parsed.data.status !== editing.status) &&
      !window.confirm(
        "Confirm this access change? Existing sessions will lose access.",
      )
    )
      return;
    startTransition(async () => {
      const result = await changeUserAuthority(parsed.data);
      setNotice(result);
      if (result.ok) {
        setEditing(null);
        router.refresh();
      }
    });
  }
  return (
    <>
      {notice && (
        <div
          role="status"
          className={"admin-notice " + (notice.ok ? "success" : "danger")}
        >
          {notice.message}
        </div>
      )}
      {pendingRevocations > 0 && (
        <div className="admin-notice warning">
          <div>
            <strong>Session cleanup pending</strong>
            <p>
              Changed accounts are already protected. {pendingRevocations}{" "}
              cleanup task(s) need attention.
            </p>
          </div>
          <button
            className="admin-button secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setNotice(await retryUserRevocations());
                router.refresh();
              })
            }
          >
            Retry cleanup
          </button>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="admin-empty">
          <span aria-hidden="true">◎</span>
          <h2>No users found</h2>
          <p>Try a different search, or register an account to add a user.</p>
        </div>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <caption className="sr-only">Users and account permissions</caption>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Last login</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.authUserId}>
                  <td>
                    <div className="admin-person">
                      <span className="admin-avatar" aria-hidden="true">
                        {(row.name || "U").slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <strong>{row.name || "Unnamed account"}</strong>
                        <small>{row.email || row.authUserId}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={"admin-pill role-" + row.role.toLowerCase()}
                    >
                      {row.role === "ADMIN"
                        ? "Administrator"
                        : row.role === "STAFF"
                          ? "Staff"
                          : "Customer"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        "admin-status " +
                        (row.status === "ACTIVE" ? "active" : "disabled")
                      }
                    >
                      {row.status === "ACTIVE" ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    {new Date(row.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td>
                    {row.lastLoginAt
                      ? new Date(row.lastLoginAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })
                      : "—"}
                  </td>
                  <td>
                    <button
                      className="admin-button secondary"
                      onClick={() => {
                        setEditing(row);
                        setNotice(null);
                      }}
                    >
                      Manage<span className="sr-only"> {row.name}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <div className="admin-editor">
          <div className="admin-section-title">
            <div>
              <span className="admin-eyebrow">Account access</span>
              <h2>Manage {editing.name || "user"}</h2>
            </div>
            <button
              className="admin-button secondary"
              disabled={pending}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
          <form action={save} className="admin-edit-form">
            <label>
              Role
              <select
                name="role"
                defaultValue={editing.role}
                disabled={pending}
              >
                {stateValues.Role.map((role) => (
                  <option key={role} value={role}>
                    {role === "ADMIN"
                      ? "Administrator"
                      : role === "STAFF"
                        ? "Staff"
                        : "Customer"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Account status
              <select
                name="status"
                defaultValue={editing.status}
                disabled={pending}
              >
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </label>
            <p className="admin-muted">
              Changing access signs out previous sessions. The last active
              administrator is protected.
            </p>
            <button className="admin-button" type="submit" disabled={pending}>
              {pending ? "Saving changes…" : "Save access"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
