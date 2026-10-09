import { headers } from "next/headers";
import { AddressManager } from "@/modules/addresses/manager";
import { loadSavedAddresses } from "@/modules/addresses/service";

export const metadata = {
  title: "Saved addresses",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const addresses = await loadSavedAddresses(new Headers(await headers()));
  return <AddressManager initial={addresses} />;
}
