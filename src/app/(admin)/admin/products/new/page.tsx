import { headers } from "next/headers";
import { getCatalog } from "@/modules/catalog/runtime";
import { ProductEditor } from "@/modules/catalog/editor";
export default async function Page() {
  const data = await (await getCatalog()).editor(new Headers(await headers()));
  return <ProductEditor data={data} />;
}
