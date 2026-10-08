"use client";
import { useState } from "react";
import { broadcastSessionChange } from "../../shared/ui/storefront/session-change";
export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="admin-signout"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const result = await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!result.ok) throw new Error();
            broadcastSessionChange();
            // A full navigation deliberately discards session-scoped client state.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/login");
          } catch {
            setError("Could not sign out. Try again.");
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
