import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getIdentity } from "./runtime";

/** Layout check only; every data service must also check fresh authority at its boundary. */
export async function requireAccountPage(admin = false) {
  let permitted = false;
  try {
    const requestHeaders = new Headers(await headers());
    const identity = await getIdentity();
    const session = await identity.auth.api.getSession({
      headers: requestHeaders,
    });
    if (session) {
      await identity.requireAccess(
        requestHeaders,
        admin ? "catalog.manage" : "profile.own",
        session.user.id,
      );
      permitted = true;
    }
  } catch {
    /* Configuration/database failure never grants page access. */
  }
  if (!permitted) redirect("/login");
}
