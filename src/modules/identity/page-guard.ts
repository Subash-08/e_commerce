import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getIdentity } from "./runtime";

/** Layout check only; every data service must also check fresh authority at its boundary. */
export async function requireAccountPage(admin = false) {
  let account:
    { id: string; name: string; email: string; role: string } | undefined;
  try {
    const requestHeaders = new Headers(await headers());
    const identity = await getIdentity();
    const session = await identity.auth.api.getSession({
      headers: requestHeaders,
    });
    if (session) {
      const authority = await identity.requireAccess(
        requestHeaders,
        admin ? "catalog.manage" : "profile.own",
        session.user.id,
      );
      account = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: authority.role,
      };
    }
  } catch {
    /* Configuration/database failure never grants page access. */
  }
  if (!account) redirect("/login");
  return account;
}
