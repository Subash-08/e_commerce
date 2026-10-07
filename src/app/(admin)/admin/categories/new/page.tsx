import Link from "next/link";
import { headers } from "next/headers";
import { getCategories } from "@/modules/categories/runtime";
import { CategoryForm } from "@/modules/categories/category-form";
import { AdminPageHeader } from "@/shared/ui/admin";
import type { CategoryInput } from "@/modules/categories/validation";

const initial: CategoryInput = {
  name: "",
  slug: "",
  parentId: null,
  description: "",
  active: true,
  featured: false,
  archived: false,
  deactivationReason: "",
  displayOrder: 0,
  thumbnailId: null,
  bannerId: null,
  seo: {
    title: "",
    description: "",
    canonicalPath: "",
    robotsIndex: true,
    robotsFollow: true,
  },
};

export default async function NewCategoryPage() {
  const data = await (
    await getCategories()
  ).editorData(new Headers(await headers()));
  return (
    <section>
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin/categories">Categories</Link>
        <span>/</span>
        <span>New category</span>
      </nav>
      <AdminPageHeader
        eyebrow="Catalog organization"
        title="Create category"
        description="Add a storefront category, media, hierarchy and search metadata."
      />
      <CategoryForm
        initial={initial}
        initialMedia={data.media}
        options={data.options}
      />
    </section>
  );
}
