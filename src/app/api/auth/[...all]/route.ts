import { handleIdentityRequest } from "@/modules/identity/http";
import { getIdentity } from "@/modules/identity/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return handleIdentityRequest(request, getIdentity);
}
export function POST(request: Request) {
  return handleIdentityRequest(request, getIdentity);
}
