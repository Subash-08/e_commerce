import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { couponEditor } from "@/modules/coupons/admin";
import { CouponForm } from "@/modules/coupons/form";
import { AdminPageHeader } from "@/shared/ui/admin";
export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data;
  try {
    data = await couponEditor(new Headers(await headers()), id);
  } catch (error) {
    if (error instanceof Error && error.message === "COUPON_NOT_FOUND")
      notFound();
    throw error;
  }
  return (
    <section>
      <AdminPageHeader
        eyebrow="Promotions"
        title="Edit coupon"
        description="Existing orders keep their original discount snapshots."
      />
      <CouponForm initial={data.value} choices={data.choices} />
    </section>
  );
}
