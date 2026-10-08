import { headers } from "next/headers";
import Link from "next/link";
import { AdminPageHeader } from "@/shared/ui/admin";
import { loadShippingAdmin } from "@/modules/shipping/service";
import { ShippingForm } from "@/modules/shipping/form";
export const dynamic = "force-dynamic";
export default async function ShippingPage() {
  const data = await loadShippingAdmin(new Headers(await headers()));
  return (
    <>
      <Link href="/admin/settings">Settings</Link>
      <AdminPageHeader
        eyebrow="Store configuration"
        title="Shipping settings"
        description="Delivery charges, supported destinations and cash-on-delivery rules."
      />
      <ShippingForm data={data} />
    </>
  );
}
