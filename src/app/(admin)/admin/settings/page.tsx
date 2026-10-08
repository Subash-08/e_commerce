import Link from "next/link";
import { AdminPageHeader, AdminPanel } from "@/shared/ui/admin";
export default function Page() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Configuration"
        title="Store settings"
        description="Manage the policies your store uses."
      />
      <AdminPanel>
        <h2>Delivery and shipping</h2>
        <p>
          Configure delivery charges, supported locations, free-shipping
          thresholds and COD policy.
        </p>
        <Link className="admin-button primary" href="/admin/settings/shipping">
          Shipping settings
        </Link>
      </AdminPanel>
    </>
  );
}
