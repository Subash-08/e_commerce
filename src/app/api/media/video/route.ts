import { getIdentity } from "@/modules/identity/runtime";
import { uploadVideo } from "@/modules/media/video";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : "";
  const local =
    process.env.NODE_ENV !== "production" &&
    ["http://localhost:3300", "http://127.0.0.1:3300"].includes(origin ?? "");
  if (!origin || (origin !== allowed && !local))
    return Response.json({ message: "Origin not allowed." }, { status: 403 });
  try {
    const actor = await (
      await getIdentity()
    ).requireAccess(request.headers, "media.manage");
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ message: "Video required." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 3_100_000) {
        await reader.cancel();
        return Response.json(
          { message: "Use a video under 3 MB or a YouTube link." },
          { status: 413 },
        );
      }
      chunks.push(part.value);
    }
    const bytes = Buffer.concat(chunks);
    const form = await new Response(bytes, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    const asset = await uploadVideo(
      form.get("file") as File,
      String(form.get("title") ?? ""),
      actor.authUserId,
    );
    return Response.json(
      { asset },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        message:
          "Video upload failed. Use MP4 or WebM under 3 MB, or a YouTube link.",
      },
      { status: 400 },
    );
  }
}
