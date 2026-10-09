import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { readOwnedOrder } from "@/modules/orders/service";
import { OrderDetail } from "@/modules/orders/detail";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  let order;
  try {
    const jar = await cookies();
    order = await readOwnedOrder(
      await headers(),
      orderNumber,
      jar.get("commerce-order-" + orderNumber)?.value,
    );
  } catch {
    notFound();
  }
  return <OrderDetail order={order} />;
}
