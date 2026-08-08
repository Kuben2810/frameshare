---
label: wayfinder:research
status: resolved
blocks: T05-database-schema
---

## Question

How should photo uploads flow in Frameshare — browser → Next.js server → S3, or browser → S3 presigned URL directly — given Next.js App Router, 50 MB file limit, Docker Compose self-hosting, and S3-compatible storage (MinIO / R2 / Backblaze)?

Research should surface:
- Whether Next.js App Router can reliably handle 50 MB multipart uploads (memory, timeouts, Vercel limits on hosted tier)
- How presigned URL uploads work with S3-compatible providers (MinIO, R2, Backblaze B2) — any compatibility gaps
- How to track upload progress client-side for each approach
- How storage quota enforcement (10 GB cap) fits into each approach
- What the schema implications are (e.g., pending-upload state, S3 key format)

## Resolution

**Decision: presigned PUT URL — browser uploads directly to S3-compatible storage. No server proxy.**

---

### 1. Can Next.js App Router reliably handle 50 MB multipart uploads?

No — not reliably, and especially not on Vercel. The constraints stack against it:

- **Server Actions**: default body limit is 1 MB. Configurable via `serverActions.bodySizeLimit` in `next.config.js`, but community reports show this setting is unreliable in production (does not apply consistently, particularly with `output: "standalone"` Docker builds).
- **Route Handlers**: no shared Server Action limit, but the raw request body still buffers in Node.js memory. A 50 MB file means ~50 MB of heap pressure per concurrent upload — unacceptable under any reasonable load.
- **Vercel (hosted tier)**: hard 4.5 MB payload cap on serverless functions; 10-second execution timeout. 50 MB uploads are structurally impossible.
- **Self-hosted Docker**: timeouts disappear and you control memory, but you're still burning server bandwidth for every byte — a waste when S3-compatible storage is already in the stack.

**Verdict:** Even on self-hosted Docker, proxying 50 MB files through Next.js is wasteful and fragile. The proxy approach only wins if you need to inspect or transform every byte server-side (e.g., virus scanning inline) — Frameshare does not.

---

### 2. Presigned URL compatibility across MinIO, R2, and Backblaze B2

All three implement the S3 API and support presigned PUT URLs via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Key gotchas per provider:

**MinIO (self-hosted Docker)**
- Must set `forcePathStyle: true` in `S3Client` config — MinIO uses path-style URLs (`host/bucket/key`), not virtual-hosted style (`bucket.host/key`).
- CORS: MinIO has historically been patchy about returning `Access-Control-Allow-Origin` on presigned PUT responses. Configure CORS via `mc` CLI or `PutBucketCorsCommand`. Set `AllowedHeaders: ["*"]` — MinIO handles the wildcard correctly (unlike R2).
- Known `SignatureDoesNotMatch` errors with AWS SDK v3 are resolved by ensuring the endpoint URL matches exactly what MinIO exposes (no trailing slash, correct scheme).

**Cloudflare R2**
- `forcePathStyle: false` (R2 uses virtual-hosted style by default, but also works path-style — omit the option).
- CORS critical gotcha: `AllowedHeaders: ["*"]` does **not** work on R2. Must enumerate headers explicitly: `["content-type", "content-length"]`. R2 fixed case-sensitivity bugs in AllowedHeaders (2024), but the wildcard gap remains.
- Configure CORS programmatically via `PutBucketCorsCommand` (no UI at time of writing).

**Backblaze B2**
- S3-compatible endpoint: `s3.us-west-004.backblazeb2.com` (region varies by bucket).
- Configure CORS in the B2 bucket settings UI or via S3 API — B2 supports the standard `PutBucketCors` call.
- Use `@aws-sdk/client-s3` pointing at the B2 S3 endpoint; `forcePathStyle: false`.
- Presigned PUT works correctly; same `content-type` header enumeration recommended (safer than wildcard across all providers).

**Common CORS config (safe across all three):**
```json
{
  "AllowedOrigins": ["https://yourdomain.com"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["content-type", "content-length"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```
In development with MinIO, `AllowedOrigins: ["*"]` is acceptable.

---

### 3. Upload progress client-side

`fetch()` does not expose upload progress events. Use `XMLHttpRequest` with the `upload.onprogress` event — this works identically for presigned PUT URLs regardless of storage provider:

```ts
// ponytail: XHR for progress; fetch has no upload progress API
function uploadWithProgress(
  presignedUrl: string,
  file: File,
  onProgress: (pct: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(xhr.status));
    xhr.onerror = reject;
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}
```

For the server proxy approach, you'd need SSE or WebSocket to relay progress — significantly more complex and still constrained by the memory/timeout issues above.

---

### 4. Storage quota enforcement (10 GB cap)

With presigned URLs, the enforcement point is the URL-generation endpoint — you check quota **before** signing:

```ts
// Server Action or Route Handler: POST /api/uploads/sign
export async function signUpload(fileName: string, fileSize: number, userId: string) {
  const used = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { storageUsed: true } });
  if (used.storageUsed + fileSize > TEN_GB) throw new Error("quota_exceeded");

  // Atomically reserve quota before signing
  await db.update(users).set({ storageUsed: sql`storage_used + ${fileSize}` }).where(eq(users.id, userId));

  const key = `${userId}/${crypto.randomUUID()}-${sanitize(fileName)}`;
  const url = await getSignedUrl(s3Client, new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: detectMimeType(fileName),
    ContentLength: fileSize,  // S3 enforces this on PUT
  }), { expiresIn: 900 });

  // Insert pending photo row
  await db.insert(photos).values({ userId, s3Key: key, fileSize, status: "pending" });
  return { url, key };
}
```

Two-phase enforcement: reserve quota optimistically at sign-time, release if upload is never confirmed (see schema section). The `ContentLength` embedded in the presigned PUT signature means S3 will reject the upload if the client sends a different number of bytes — partial enforcement at the storage layer.

For presigned POST (alternative): supports `content-length-range` conditions in the POST policy, giving stricter server-side size enforcement per upload. Worth considering if abuse (clients bypassing `fileSize` in the sign request) is a concern. For MVP with authenticated users, presigned PUT is simpler and sufficient.

---

### 5. DB schema implications

Two key additions to the `photos` table:

```sql
-- status tracks the upload lifecycle
status TEXT NOT NULL DEFAULT 'pending'  -- 'pending' | 'ready' | 'failed'

-- s3_key is set at sign-time, before bytes arrive
s3_key TEXT NOT NULL

-- file_size is set at sign-time (client-reported, bounded by ContentLength)
file_size_bytes INTEGER NOT NULL
```

**S3 key format:** `{userId}/{uuid}-{sanitized-filename}`  
Example: `usr_abc123/f47ac10b-58cc-4372-a567-0e02b2c3d479-wedding-shoot.jpg`

- UUID prevents collisions and prevents key enumeration.
- `userId` prefix enables per-user lifecycle rules or prefix-scoped IAM policies.
- Sanitize the original filename for display metadata, but never use it raw as the key.

**Pending cleanup:** rows with `status = 'pending'` older than 30 minutes are orphaned uploads (client died, URL expired). A cron job (or on-demand at gallery-open) deletes them and releases quota:

```sql
DELETE FROM photos WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes';
-- also: UPDATE users SET storage_used = storage_used - file_size_bytes WHERE ...
```

**On upload confirmation:** client calls a lightweight `POST /api/uploads/confirm` with the `key`, server verifies the object exists in S3 (`HeadObject`), then flips `status = 'ready'`.

---

### Recommended libraries

```
@aws-sdk/client-s3          # S3Client, PutObjectCommand, HeadObjectCommand
@aws-sdk/s3-request-presigner  # getSignedUrl
```

No additional upload libraries needed. `@aws-sdk/client-s3` works against MinIO, R2, and B2 with only endpoint/pathStyle config changes — all driven by env vars. Do not add `multer`, `formidable`, or any server-side multipart parser; they are unnecessary with this approach.

---

### Summary

| Concern | Presigned PUT | Server Proxy |
|---|---|---|
| 50 MB on Vercel | Works (bypasses all limits) | Impossible (4.5 MB cap) |
| 50 MB self-hosted Docker | Works | Works but wasteful |
| Upload progress | XHR `upload.onprogress` | Needs SSE/WS relay |
| Quota enforcement | Pre-sign check + reserve | Inline check |
| MinIO CORS | Configure + `forcePathStyle: true` | N/A |
| R2 CORS | Enumerate headers, no wildcard | N/A |
| Complexity | Low | High |

Presigned PUT is the clear choice. The only scenario where a server proxy wins is needing to scan every byte inline (antivirus, content moderation) — out of scope for Frameshare MVP.
