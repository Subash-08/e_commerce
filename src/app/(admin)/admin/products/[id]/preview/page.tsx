import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCatalog } from "@/modules/catalog/runtime";
import { readPublicProduct } from "@/modules/catalog/public";
import { ProductDetail } from "@/modules/catalog/detail";
import "@/shared/styles/product.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Private product preview",
  robots: { index: false, follow: false },
};
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const data = await (
    await getCatalog()
  ).editor(new Headers(await headers()), (await params).id);
  if (!data.value) notFound();
  const product = await readPublicProduct(data.value.slug, true);
  if (!product) notFound();
  return (
    <div className="product-page">
      <p className="admin-notice warning">
        Private preview of saved content. This page is not public or indexed.
      </p>
      <Suspense fallback={<p>Loading preview…</p>}>
        <ProductDetail product={product} />
      </Suspense>
    </div>
  );
}
