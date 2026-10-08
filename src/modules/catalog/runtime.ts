import "server-only";
import { getDatabase } from "../../server/db/connection";
import { getIdentity } from "../identity/runtime";
import { catalogService } from "./service";
export async function getCatalog() {
  const identity = await getIdentity();
  return catalogService(await getDatabase(), (headers) =>
    identity.requireAccess(headers, "catalog.manage"),
  );
}
