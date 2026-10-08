import { headers } from "next/headers";
import { getIdentity } from "@/modules/identity/runtime";
import { CheckoutClient } from "@/modules/checkout/client";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};
export default async function Page() {
  let account: { name: string; email: string } | null = null;
  try {
    const identity = await getIdentity();
    const session = await identity.auth.api.getSession({
      headers: new Headers(await headers()),
    });
    if (session)
      account = { name: session.user.name, email: session.user.email };
  } catch {
    /* Checkout UI still renders and the quote service fails closed. */
  }
  return <CheckoutClient account={account} />;
}
