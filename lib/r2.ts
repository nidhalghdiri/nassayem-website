import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || "nassayem-properties";
const publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

export async function uploadToR2(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  // Return public CDN URL
  return `${publicUrl}/${key}`;
}

export async function deleteFromR2(keyOrUrl: string): Promise<void> {
  let key = keyOrUrl;
  if (keyOrUrl.startsWith("http")) {
    const url = new URL(keyOrUrl);
    key = url.pathname.replace(/^\//, "");
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await r2Client.send(command);
}

export function getR2PublicUrl(key: string): string {
  return `${publicUrl}/${key.replace(/^\//, "")}`;
}
