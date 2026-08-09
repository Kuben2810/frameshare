import { S3Client } from "@aws-sdk/client-s3"

export const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  // ponytail: disable SDK-injected checksums — R2 doesn't support them and they break browser presigned PUTs
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

export const BUCKET = process.env.S3_BUCKET!

export function publicUrl(key: string) {
  const base = process.env.S3_PUBLIC_URL!.replace(/\/$/, "")
  return `${base}/${key}`
}
