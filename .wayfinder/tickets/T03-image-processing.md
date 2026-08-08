---
label: wayfinder:research
status: closed
blocks: T05-database-schema
---

## Question

How should Frameshare handle thumbnail generation, low-res watermarked variant generation, and format normalization — on upload (pre-generate) or on demand — given Next.js, Sharp.js, S3-compatible storage, and self-hosted Docker Compose deployment?

Research should surface:
- Sharp.js integration in Next.js App Router (server actions vs API routes vs background job)
- Pre-generate vs on-demand trade-offs: storage cost vs latency vs complexity
- How Next.js `<Image>` optimization interacts with S3-stored originals — whether to use it or bypass it
- Watermark implementation: text rendering with Sharp (corner text, photographer name), font handling
- What variants to store: original, display-size (e.g. 2000px max), thumbnail (e.g. 400px), low-res watermarked (e.g. 1200px)
- Schema implications: how variant URLs/keys are stored per photo
- Self-hosting constraint: no external image CDN assumed; MinIO serves files directly

## Resolution

**Verdict: pre-generate all variants at upload time, run Sharp in a Next.js API route (not a server action), use a Node.js Debian-based Docker image, and bypass `next/image` optimisation entirely — serve all variants as direct S3/MinIO URLs.**

---

### 1. Sharp.js in Next.js App Router — and the Docker gotcha

Sharp is a native Node.js module that wraps libvips. It works fine in Next.js API routes and server actions, but has one consistent footgun in Docker deployments: **the libc mismatch**.

- Alpine Linux uses musl libc. Sharp's prebuilt binaries target glibc (Debian/Ubuntu). If you `npm install sharp` on the host or in a builder stage with glibc, then copy `node_modules` into an Alpine runtime stage, it crashes with a missing `.node` binary error.
- **Fix:** Use `node:20-slim` (Debian) as your Docker base, not `node:20-alpine`. Slim is only ~50 MB larger and eliminates the entire problem class.
- If Alpine is a hard requirement: install sharp with `npm install --cpu=x64 --os=linux --libc=musl sharp` in the final stage and call `sharp.cache(false)` to avoid musl's smaller stack size causing stack overflows in libvips.
- For Next.js `output: 'standalone'` (recommended for Docker): sharp's native binaries are not automatically traced by `@vercel/nft`. Add `sharp` to `serverExternalPackages` in `next.config.js` and copy `node_modules/sharp` explicitly in the Dockerfile's final stage. This is a well-documented issue (sharp issue #3877, #4543).

```js
// next.config.js
module.exports = {
  output: 'standalone',
  serverExternalPackages: ['sharp'],
}
```

```dockerfile
# Dockerfile (final stage, node:20-slim base)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img
```

Sharp should live in a **Next.js API route** (e.g. `POST /api/photos/process`), not a server action. Server actions have a 10s timeout in some hosting environments and are not designed for CPU-bound work. An API route called from within a server action (or directly after upload confirmation) is the right seam. On self-hosted Docker Compose, there is no serverless timeout ceiling, but structuring it as an API route keeps the option open to extract it to a sidecar worker later without touching the call site.

---

### 2. Pre-generate vs on-demand — recommendation: pre-generate

**On-demand generation** (generate a variant only when first requested, then cache to S3) adds a request-time latency spike on cache miss and requires either a lock/mutex to prevent thundering herd (multiple clients hitting the same uncached variant simultaneously) or accepting duplicate work. For a photo gallery where the client opens a gallery and the browser fires 30+ thumbnail requests simultaneously, every cache miss is a UI-visible stall. Nextcloud's gallery team learned this the hard way — their on-demand approach required a separate background pre-generation plugin to get acceptable UX.

**Pre-generate at upload** means: the upload API route (or the processing API route called after the presigned-URL upload completes) runs Sharp synchronously before returning `201 Created` to the client. The photo record is not written to the DB until all variants exist on S3. This keeps the system in a consistent state — no partially-processed photos visible to galleries.

For Frameshare's scale (self-hosted, single photographer, galleries up to a few hundred photos), synchronous processing on upload is the right call. An Immich-style async job queue is correct at thousands of photos/day; it is overengineered here. If upload processing becomes the bottleneck, extracting to a queue is a one-file change.

**Storage cost:** Three pre-generated variants per photo at typical JPEG quality means roughly 2–4× original file size in total storage (thumbnail is tiny, display-size is the dominant cost). For the 10 GB hosted tier cap, this is a real multiplier. Account for it in quota tracking: count all variant sizes against quota, not just the original. Keep the variant sizes in the DB so the quota sum is a cheap SQL query, not an S3 list operation.

---

### 3. Variants to pre-generate

| Variant | Max dimension | Format | Purpose |
|---|---|---|---|
| `original` | (unchanged) | (unchanged, stored as-is) | Archival, full-res download |
| `display` | 2048px longest edge | WebP, quality 85 | Gallery slideshow / large preview |
| `thumb` | 400px longest edge | WebP, quality 80 | Grid thumbnail |
| `watermarked` | 1200px longest edge | JPEG, quality 82 | Low-res download with watermark |

Notes:
- WebP for display and thumb because browser support is universal and file sizes are 25–35% smaller than JPEG at equivalent quality. The original is kept as-is (JPEG/PNG/TIFF/WebP) per product decision.
- The watermarked variant is JPEG rather than WebP because download recipients may open in older software; JPEG is the safe default for deliverables.
- TIFF originals: Sharp reads TIFF natively. Just resize and re-encode; no special handling needed.
- Do not generate a separate display-size watermarked variant — the 1200px watermarked variant already covers the "low-res download" use case from the product spec. Generating both a 1200px display and a 1200px watermarked would waste storage and confuse the variant naming.

Sharp pipeline for each upload (pseudo-code, all three can be parallelised with `Promise.all`):

```ts
import sharp from 'sharp'

const src = await s3.getObject({ Bucket, Key: originalKey }).Body // stream

const [meta] = await Promise.all([
  // thumb
  sharp(src).clone()
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
    .then(buf => s3.putObject({ Bucket, Key: thumbKey, Body: buf, ContentType: 'image/webp' })),

  // display
  sharp(src).clone()
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()
    .then(buf => s3.putObject({ Bucket, Key: displayKey, Body: buf, ContentType: 'image/webp' })),

  // watermarked
  generateWatermarked(src, displayName, 1200, watermarkedKey),
])
```

**Gotcha:** `sharp()` consumes a stream once. Either pass a `Buffer` (load the original into memory once), or call `sharp(buffer)` with `clone()` for each pipeline branch. For a 50 MB original, this means ~50 MB peak memory per upload. On a 1 GB Docker container this is fine for sequential uploads; if concurrent uploads spike, add a semaphore (`p-limit(3)` or similar).

---

### 4. Watermark implementation

Sharp has no native text rendering. The canonical approach is an SVG overlay composited onto the image.

**Font handling without system fonts:** Sharp delegates SVG rendering to librsvg, which uses fontconfig. If no system fonts are installed (minimal Docker image), the SVG text falls back to a generic serif — unpredictable and ugly.

Two clean options:

**Option A (recommended): embed the font as a base64 data URI in the SVG.**
Bundle a single `.woff2` or `.ttf` font file (e.g. Inter, Lato, or any open-licence font) in the repo under `src/assets/fonts/`. At startup, read it into memory and base64-encode it. Embed it in a `<style>` block in the SVG. librsvg renders it correctly without any system font installation.

```ts
import fs from 'fs'
import path from 'path'

const fontPath = path.join(process.cwd(), 'src/assets/fonts/Inter-Regular.ttf')
const fontB64 = fs.readFileSync(fontPath).toString('base64')

function watermarkSvg(text: string, imgW: number, imgH: number): Buffer {
  const fontSize = Math.max(16, Math.round(imgW * 0.022)) // ~2.2% of width
  const padding = Math.round(fontSize * 0.8)
  const svg = `
    <svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @font-face {
            font-family: 'WMFont';
            src: url('data:font/truetype;base64,${fontB64}');
          }
        </style>
      </defs>
      <text
        x="${imgW - padding}"
        y="${imgH - padding}"
        font-family="WMFont, sans-serif"
        font-size="${fontSize}"
        fill="white"
        fill-opacity="0.75"
        text-anchor="end"
        dominant-baseline="auto"
        paint-order="stroke"
        stroke="black"
        stroke-width="2"
        stroke-opacity="0.5"
      >${escapeXml(text)}</text>
    </svg>`
  return Buffer.from(svg)
}

async function generateWatermarked(
  srcBuffer: Buffer,
  displayName: string,
  maxPx: number,
  s3Key: string,
) {
  const resized = await sharp(srcBuffer)
    .resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true })

  const { width, height } = resized.info
  const overlay = watermarkSvg(displayName, width!, height!)

  const output = await sharp(resized.data)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 82 })
    .toBuffer()

  await s3.putObject({ Bucket, Key: s3Key, Body: output, ContentType: 'image/jpeg' })
}
```

The `stroke` + `fill` with 0.75 opacity gives readable white text on any background without needing a semi-transparent box. `text-anchor="end"` pins it to the bottom-right corner.

**Option B:** Use `resvg-js` (a pure-Rust SVG renderer with Node.js bindings) for font loading via `loadFonts()`. More control, but adds a dependency. Not needed unless librsvg's font handling proves unreliable in the Docker image.

**escapeXml helper** (required — photographer names can contain `&`, `<`, `>`):

```ts
function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
```

---

### 5. Next.js `<Image>` component — bypass it

`next/image` optimisation works by proxying image URLs through a Next.js endpoint (`/_next/image?url=...&w=...&q=...`), which re-encodes them on demand and caches locally. This is the right tool when you don't control the source images and need format conversion on the fly.

For Frameshare, it is the wrong tool because:
- All variants are already pre-generated in WebP/JPEG at the correct sizes. Running them through the Next.js optimiser again wastes CPU and adds latency.
- The optimiser cache lives on the Next.js server's filesystem, not on S3 — it would grow unboundedly and be lost on container restart.
- MinIO URLs are direct — they work as plain `<img src="...">` or `unoptimized` `<Image>`.
- Configuring `remotePatterns` for MinIO works (same S3-compatible API), but you are paying the overhead for no gain.

**Decision:** Use a plain `<img>` tag for the pre-generated variant URLs, or `<Image unoptimized src={variant.displayUrl} />` if you want Next.js's `sizes`/lazy-loading attributes. The pre-generated thumb URL goes directly to MinIO. No `remotePatterns` config needed if using `<img>`.

Exception: if a future hosted tier uses a real CDN (Cloudflare R2 + Cloudflare Images, etc.), revisit. For self-hosted MinIO, direct URLs win.

---

### 6. Schema implications for T05

The `Photo` table needs the following variant fields. Two clean options:

**Option A — flat columns (recommended for this variant set):**
```sql
photos (
  id            uuid primary key,
  gallery_id    uuid references galleries(id),
  original_key  text not null,         -- S3 key, e.g. "photos/{id}/original.jpg"
  display_key   text,                  -- "photos/{id}/display.webp"
  thumb_key     text,                  -- "photos/{id}/thumb.webp"
  watermarked_key text,                -- "photos/{id}/watermarked.jpg"
  original_size_bytes bigint not null, -- for quota sum
  display_size_bytes  bigint,
  thumb_size_bytes    bigint,
  watermarked_size_bytes bigint,
  width         int,                   -- original dimensions
  height        int,
  mime_type     text not null,
  filename      text not null,
  status        text not null default 'processing', -- 'processing' | 'ready' | 'error'
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
)
```

Flat columns are preferable here because the variant set is fixed (four variants), each needs its own size for quota tracking, and querying `WHERE status = 'ready'` or summing storage is a simple expression. JSONB would make quota summing awkward (`(variants->>'display_size_bytes')::bigint`).

**Option B — JSONB `variants` column:** Fine if you expect variant names to be dynamic (e.g. multiple watermark styles per photo). Not needed for MVP.

**S3 key convention:**
```
photos/{photo_id}/original.{ext}
photos/{photo_id}/display.webp
photos/{photo_id}/thumb.webp
photos/{photo_id}/watermarked.jpg
```
Using the photo UUID as a path prefix means all variants are co-located and can be deleted with a single S3 prefix delete when the photo is removed.

**Quota tracking:** Sum `original_size_bytes + display_size_bytes + thumb_size_bytes + watermarked_size_bytes` across all photos for a user via a JOIN through galleries. Do this in SQL at upload time; do not re-scan S3 for quota checks.

**`status` field:** The photo row is inserted with `status = 'processing'` after the original lands on S3, before variants are generated. Gallery queries filter `WHERE status = 'ready'` so partially-processed photos are never shown to clients. If variant generation fails, set `status = 'error'` and surface it in the photographer's dashboard.

---

### Summary of decisions

| Question | Answer |
|---|---|
| Pre-generate or on-demand? | Pre-generate at upload, synchronously in the processing API route |
| Sharp integration point | Next.js API route (`POST /api/photos/process`), called after presigned upload completes |
| Docker base image | `node:20-slim` (Debian/glibc); copy `node_modules/sharp` and `node_modules/@img` explicitly in standalone Dockerfile |
| Variants | original (as-is), display (2048px WebP), thumb (400px WebP), watermarked (1200px JPEG) |
| Watermark technique | SVG overlay via `sharp().composite()`, font embedded as base64 data URI in `<style>` block |
| `next/image` | Bypass — use `<img>` or `<Image unoptimized>` with direct S3/MinIO URLs |
| DB schema | Flat columns for variant keys + size bytes; JSONB not needed for fixed variant set |
| S3 key pattern | `photos/{photo_id}/{variant}.{ext}` — all variants under one prefix for easy cleanup |
| `status` field | `processing → ready → error`; gallery queries filter on `ready` |
