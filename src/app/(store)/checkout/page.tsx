import { headers } from "next/headers";
import { getIdentity } from "@/modules/identity/runtime";
import { CheckoutClient } from "@/modules/checkout/client";
import { loadSavedAddresses } from "@/modules/addresses/service";
import { legalPolicyVersions } from "@/modules/checkout/legal";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};
export default async function Page() {
  let account: { name: string; email: string } | null = null;
  let addresses: Awaited<ReturnType<typeof loadSavedAddresses>> = [];
  const requestHeaders = new Headers(await headers());
  try {
    const identity = await getIdentity();
    const session = await identity.auth.api.getSession({
      headers: requestHeaders,
    });
    if (session) {
      account = { name: session.user.name, email: session.user.email };
      addresses = await loadSavedAddresses(requestHeaders);
    }
  } catch {
    /* Checkout UI still renders and the quote service fails closed. */
  }
  return (
    <CheckoutClient
      account={account}
      addresses={addresses}
      legalVersions={legalPolicyVersions}
    />
  );
}
