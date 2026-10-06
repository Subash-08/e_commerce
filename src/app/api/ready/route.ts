import { readiness } from "@/server/db/health";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
 const result = await readiness();
 return Response.json(result, {status:result.status === "ok" ? 200 : 503, headers:{"Cache-Control":"no-store"}});
}
