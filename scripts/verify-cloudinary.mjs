import "./load-environment.mjs";
import { createHash, randomUUID } from "node:crypto";

const cloud = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const key = process.env.CLOUDINARY_API_KEY ?? "";
const secret = process.env.CLOUDINARY_API_SECRET ?? "";
if (!cloud || !key || !secret) throw new Error("CLOUDINARY_CONFIG_REQUIRED");

function signature(parameters) {
  return createHash("sha256")
    .update(
      Object.entries(parameters)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => name + "=" + value)
        .join("&") + secret,
    )
    .digest("hex");
}

const publicId = "commerce/verification/" + randomUUID();
let uploaded = false;
let destroyed = false;
try {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const parameters = {
    allowed_formats: "jpg,png,webp",
    overwrite: "false",
    public_id: publicId,
    timestamp,
  };
  const form = new FormData();
  form.set(
    "file",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "verification.png",
  );
  form.set("api_key", key);
  form.set("signature", signature(parameters));
  for (const [name, value] of Object.entries(parameters)) form.set(name, value);
  const response = await fetch(
    "https://api.cloudinary.com/v1_1/" + cloud + "/image/upload",
    { method: "POST", body: form, signal: AbortSignal.timeout(20_000) },
  );
  if (!response.ok)
    throw new Error("CLOUDINARY_UPLOAD_FAILED_" + response.status);
  const result = await response.json();
  uploaded =
    result.public_id === publicId && typeof result.secure_url === "string";
  if (!uploaded) throw new Error("CLOUDINARY_UPLOAD_RESPONSE_INVALID");
} finally {
  if (uploaded) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const parameters = { invalidate: "true", public_id: publicId, timestamp };
    const form = new FormData();
    form.set("api_key", key);
    form.set("signature", signature(parameters));
    for (const [name, value] of Object.entries(parameters))
      form.set(name, value);
    const response = await fetch(
      "https://api.cloudinary.com/v1_1/" + cloud + "/image/destroy",
      { method: "POST", body: form, signal: AbortSignal.timeout(20_000) },
    );
    if (response.ok) {
      const result = await response.json();
      destroyed = result.result === "ok" || result.result === "not found";
    }
  }
}
if (!uploaded || !destroyed)
  throw new Error("CLOUDINARY_VERIFICATION_CLEANUP_FAILED");
console.info(
  JSON.stringify({ configured: true, upload: "passed", cleanup: "passed" }),
);
