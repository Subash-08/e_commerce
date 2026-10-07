import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getIdentity } from "../identity/runtime";
import { getDatabase } from "../../server/db/connection";
import { DomainError } from "../../shared/domain/errors";
import { assertOutsideTransaction } from "../../server/db/transaction";

/** Upload bytes through the server: no client-supplied URL fetch, public ID or signing parameters. */
export async function uploadImage(headers: Headers, file: File, alt: string) {
  const actor = await (
    await getIdentity()
  ).requireAccess(headers, "media.manage");
  if (
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > 900_000 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !alt.trim() ||
    alt.trim().length > 200
  )
    throw new DomainError("IMAGE_INVALID");
  const cloud = process.env.CLOUDINARY_CLOUD_NAME ?? "";
  const key = process.env.CLOUDINARY_API_KEY ?? "";
  const secret = process.env.CLOUDINARY_API_SECRET ?? "";
  if (!/^[a-zA-Z0-9_-]+$/.test(cloud) || !key || !secret)
    throw new DomainError("MEDIA_CONFIG_REQUIRED");
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid =
    (file.type === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (file.type === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (file.type === "image/webp" &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP");
  if (!valid) throw new DomainError("IMAGE_INVALID");
  assertOutsideTransaction();
  const publicId = "commerce/" + randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const parameters = `allowed_formats=jpg,png,webp&overwrite=false&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash("sha256")
    .update(parameters + secret)
    .digest("hex");
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: file.type }), "upload");
  form.set("api_key", key);
  form.set("signature", signature);
  form.set("timestamp", timestamp);
  form.set("public_id", publicId);
  form.set("overwrite", "false");
  form.set("allowed_formats", "jpg,png,webp");
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    { method: "POST", body: form, signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok) throw new DomainError("MEDIA_UPLOAD_FAILED");
  const asset = await response.json();
  if (
    asset.public_id !== publicId ||
    typeof asset.secure_url !== "string" ||
    !asset.secure_url.startsWith(
      `https://res.cloudinary.com/${cloud}/image/upload/`,
    ) ||
    !Number.isInteger(asset.width) ||
    !Number.isInteger(asset.height)
  )
    throw new DomainError("MEDIA_UPLOAD_FAILED");
  const record = {
    publicId,
    secureUrl: asset.secure_url as string,
    resourceType: "image",
    width: asset.width as number,
    height: asset.height as number,
    format: String(asset.format),
    alt: alt.trim(),
    createdBy: actor.authUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  };
  const saved = await (
    await getDatabase()
  ).db
    .collection("mediaAssets")
    .insertOne(record);
  return {
    id: saved.insertedId.toString(),
    secureUrl: record.secureUrl,
    alt: record.alt,
  };
}
