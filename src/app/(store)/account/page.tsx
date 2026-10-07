import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getIdentity } from "@/modules/identity/runtime";
import { SignOutButton } from "@/modules/identity/sign-out-button";
export default async function AccountPage() {
  const identity = await getIdentity();
  const requestHeaders = new Headers(await headers());
  const session = await identity.auth.api.getSession({
    headers: requestHeaders,
  });
  if (!session) redirect("/login");
  const actor = await identity.requireAccess(
    requestHeaders,
    "profile.own",
    session.user.id,
  );
  return (
    <main
      className="mx-auto max-w-2xl space-y-6 px-6 py-16"
      data-feature="account"
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
        Your account
      </span>
      <h1 className="text-3xl font-semibold">Welcome, {session.user.name}</h1>
      <p className="text-slate-600">{session.user.email}</p>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">Account details</h2>
        <p className="mt-3 text-sm text-slate-600">Account ID</p>
        <code className="break-all text-sm">{session.user.id}</code>
        <p className="mt-3 text-sm text-slate-600">
          Access:{" "}
          {actor.role === "ADMIN"
            ? "Administrator"
            : actor.role === "STAFF"
              ? "Staff"
              : "Customer"}
        </p>
      </div>
      {actor.role === "ADMIN" && (
        <Link
          className="inline-flex rounded-lg bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
          href="/admin/users"
        >
          Open administration →
        </Link>
      )}
      <SignOutButton />
    </main>
  );
}
