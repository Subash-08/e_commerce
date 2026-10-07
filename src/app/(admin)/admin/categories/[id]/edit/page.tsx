import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCategories } from "@/modules/categories/runtime";
import { CategoryForm } from "@/modules/categories/category-form";
import { AdminPageHeader } from "@/shared/ui/admin";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data;
  try {
    data = await (
      await getCategories()
    ).editorData(new Headers(await headers()), id);
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND")
      notFound();
    throw error;
  }
  if (!data.value) notFound();
  return (
    <section>
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin/categories">Categories</Link>
        <span>/</span>
        <span>{data.value.name}</span>
      </nav>
      <AdminPageHeader
        eyebrow="Catalog organization"
        title={"Edit " + data.value.name}
        description="Update storefront placement, images, visibility and search metadata."
      />
      <CategoryForm
        initial={data.value}
        initialMedia={data.media}
        options={data.options}
      />
    </section>
  );
}
