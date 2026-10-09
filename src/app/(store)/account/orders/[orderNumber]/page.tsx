import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { readOwnedOrder } from "@/modules/orders/service";
import { OrderDetail } from "@/modules/orders/detail";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  let order;
  try {
    order = await readOwnedOrder(await headers(), orderNumber);
  } catch {
    notFound();
  }
  return <OrderDetail order={order} />;
}
