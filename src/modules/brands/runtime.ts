import "server-only";
import { getDatabase } from "../../server/db/connection";
import { getIdentity } from "../identity/runtime";
import { brandService } from "./service";

export async function getBrands() {
  return brandService(await getDatabase(), async (headers) =>
    (await getIdentity()).requireAccess(headers, "catalog.manage"),
  );
}
