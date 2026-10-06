import { liveness } from "@/server/db/health";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return Response.json(liveness(), {headers:{"Cache-Control":"no-store"}}); }
