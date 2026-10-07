import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getBrands } from "@/modules/brands/runtime";
import { BrandForm } from "@/modules/brands/brand-form";
import { AdminPageHeader } from "@/shared/ui/admin";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data;
  try {
    data = await (
      await getBrands()
    ).editorData(new Headers(await headers()), id);
  } catch (error) {
    if (error instanceof Error && error.message === "BRAND_NOT_FOUND")
      notFound();
    throw error;
  }
  if (!data.value) notFound();
  return (
    <section>
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin/brands">Brands</Link>
        <span>/</span>
        <span>{data.value.name}</span>
      </nav>
      <AdminPageHeader
        eyebrow="Catalog identity"
        title={"Edit " + data.value.name}
        description="Update public identity, logo, visibility and search metadata."
      />
      <BrandForm initial={data.value} initialLogo={data.logo} />
    </section>
  );
}
