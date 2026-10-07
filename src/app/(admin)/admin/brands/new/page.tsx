import Link from "next/link";
import { headers } from "next/headers";
import { getBrands } from "@/modules/brands/runtime";
import { BrandForm } from "@/modules/brands/brand-form";
import type { BrandInput } from "@/modules/brands/validation";
import { AdminPageHeader } from "@/shared/ui/admin";

const initial: BrandInput = {
  name: "",
  slug: "",
  description: "",
  active: true,
  featured: false,
  archived: false,
  deactivationReason: "",
  displayOrder: 0,
  logoId: null,
  seo: {
    title: "",
    description: "",
    canonicalPath: "",
    robotsIndex: true,
    robotsFollow: true,
  },
};

export default async function NewBrandPage() {
  const data = await (
    await getBrands()
  ).editorData(new Headers(await headers()));
  return (
    <section>
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin/brands">Brands</Link>
        <span>/</span>
        <span>New brand</span>
      </nav>
      <AdminPageHeader
        eyebrow="Catalog identity"
        title="Create brand"
        description="Add a brand identity, logo, visibility and search metadata."
      />
      <BrandForm initial={initial} initialLogo={data.logo} />
    </section>
  );
}
