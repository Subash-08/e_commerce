import { headers } from "next/headers";
import { getIdentity } from "@/modules/identity/runtime";
import { CheckoutClient } from "@/modules/checkout/client";
import { loadSavedAddresses } from "@/modules/addresses/service";
import { legalPolicyVersions } from "@/modules/checkout/legal";
import { requirePaymentTestAdmin } from "@/modules/payments/access";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};
export default async function Page() {
  let account: { name: string; email: string } | null = null;
  let addresses: Awaited<ReturnType<typeof loadSavedAddresses>> = [];
  let onlineTestEnabled = false;
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
  try {
    await requirePaymentTestAdmin(requestHeaders);
    onlineTestEnabled = true;
  } catch {
    /* Online payment remains unavailable to normal customers until 2C. */
  }
  return (
    <CheckoutClient
      account={account}
      addresses={addresses}
      legalVersions={legalPolicyVersions}
      onlineTestEnabled={onlineTestEnabled}
    />
  );
}
