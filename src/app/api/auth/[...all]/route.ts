export function GET() {
  return Response.json(
    {
      placeholder: true,
      error: "NOT_IMPLEMENTED",
      message: "Stage 3 scaffold only.",
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
export function POST() {
  return Response.json(
    {
      placeholder: true,
      error: "NOT_IMPLEMENTED",
      message: "Stage 3 scaffold only.",
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
