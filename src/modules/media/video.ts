import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "../../server/db/connection";
import { assertOutsideTransaction } from "../../server/db/transaction";
import { requireFact } from "../../shared/domain/errors";
export async function uploadVideo(file: File, title: string, actorId: string) {
  requireFact(
    file instanceof File &&
      file.size > 0 &&
      file.size <= 3_000_000 &&
      ["video/mp4", "video/webm"].includes(file.type) &&
      title.trim().length > 0 &&
      title.length <= 160,
    "VIDEO_INVALID",
  );
  const bytes = Buffer.from(await file.arrayBuffer());
  requireFact(
    file.type === "video/mp4"
      ? bytes.toString("ascii", 4, 8) === "ftyp"
      : bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])),
    "VIDEO_INVALID",
  );
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  requireFact(
    cloud && /^[a-zA-Z0-9_-]+$/.test(cloud) && key && secret,
    "MEDIA_CONFIG_REQUIRED",
  );
  assertOutsideTransaction();
  const publicId = "commerce/video/" + randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: file.type }), "video");
  form.set("api_key", key);
  form.set("timestamp", timestamp);
  form.set("public_id", publicId);
  form.set("overwrite", "false");
  form.set("allowed_formats", "mp4,webm");
  form.set(
    "signature",
    createHash("sha256")
      .update(
        "allowed_formats=mp4,webm&overwrite=false&public_id=" +
          publicId +
          "&timestamp=" +
          timestamp +
          secret,
      )
      .digest("hex"),
  );
  const response = await fetch(
    "https://api.cloudinary.com/v1_1/" + cloud + "/video/upload",
    { method: "POST", body: form, signal: AbortSignal.timeout(60000) },
  );
  requireFact(response.ok, "VIDEO_UPLOAD_FAILED");
  const asset = await response.json();
  requireFact(
    asset.public_id === publicId &&
      typeof asset.secure_url === "string" &&
      asset.secure_url.startsWith(
        "https://res.cloudinary.com/" + cloud + "/video/upload/",
      ) &&
      Number.isFinite(asset.duration),
    "VIDEO_UPLOAD_FAILED",
  );
  const posterUrl =
    "https://res.cloudinary.com/" +
    cloud +
    "/video/upload/so_0/" +
    publicId +
    ".jpg";
  const record = {
    publicId,
    secureUrl: asset.secure_url as string,
    resourceType: "video",
    posterUrl,
    durationSeconds: Number(asset.duration),
    width: Number(asset.width),
    height: Number(asset.height),
    format: String(asset.format),
    bytes: Number(asset.bytes),
    alt: title.trim(),
    createdBy: actorId,
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  };
  const result = await (
    await getDatabase()
  ).db
    .collection("mediaAssets")
    .insertOne(record);
  return { id: result.insertedId.toString(), url: record.secureUrl, posterUrl };
}
