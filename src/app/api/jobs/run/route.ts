import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDueJobs } from "@/server/jobs/runner";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function authorized(request: Request) {
  const expected = process.env.JOBS_TRIGGER_SECRET;
  const actual = request.headers.get("x-jobs-secret");
  if (!expected || expected.length < 32 || !actual) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function POST(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  try {
    return NextResponse.json(await runDueJobs(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { code: "JOBS_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
