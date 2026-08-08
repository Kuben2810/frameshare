import { GetObjectCommand } from "@aws-sdk/client-s3"
import { s3, BUCKET } from "@/lib/s3"

// ponytail: simple S3 proxy for self-hosted MinIO where files aren't publicly accessible
// On R2/Backblaze with public bucket, skip this and use S3_PUBLIC_URL directly
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params
  const s3Key = key.join("/")

  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }))
    const body = res.Body as ReadableStream
    return new Response(body, {
      headers: {
        "Content-Type": res.ContentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
