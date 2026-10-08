import { headers } from "next/headers";
import { couponEditor } from "@/modules/coupons/admin";
import { CouponForm } from "@/modules/coupons/form";
import { AdminPageHeader } from "@/shared/ui/admin";
export default async function NewCouponPage() {
  const data = await couponEditor(new Headers(await headers()));
  return (
    <section>
      <AdminPageHeader
        eyebrow="Promotions"
        title="Create coupon"
        description="Configure a targeted offer and preview it in the cart."
      />
      <CouponForm initial={null} choices={data.choices} />
    </section>
  );
}
