import "server-only";
import { getDatabase } from "../../server/db/connection";
import { getIdentity } from "../identity/runtime";
import { categoryService } from "./service";
export async function getCategories() {
  return categoryService(await getDatabase(), async (headers) =>
    (await getIdentity()).requireAccess(headers, "catalog.manage"),
  );
}
