import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCatalog } from "@/modules/catalog/runtime";
import { ProductEditor } from "@/modules/catalog/editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let data;
  try {
    data = await (
      await getCatalog()
    ).editor(new Headers(await headers()), (await params).id);
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND")
      notFound();
    throw error;
  }
  return <ProductEditor key={data.value?.revision} data={data} />;
}
