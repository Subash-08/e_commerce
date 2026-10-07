"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SignOutButton() {
  const router = useRouter();
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
            router.push("/login");
            router.refresh();
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
