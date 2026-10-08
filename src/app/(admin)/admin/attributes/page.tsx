import { headers } from "next/headers";
import { getDatabase } from "@/server/db/connection";
import { getIdentity } from "@/modules/identity/runtime";
import { attributeService } from "@/modules/attributes/service";
import { AttributeWorkspace } from "@/modules/attributes/editor";
export default async function AttributesPage() {
  const identity = await getIdentity();
  const rows = await attributeService(await getDatabase(), (h) =>
    identity.requireAccess(h, "catalog.manage"),
  ).list(new Headers(await headers()));
  return <AttributeWorkspace rows={rows} />;
}
