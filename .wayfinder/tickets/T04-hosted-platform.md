---
label: wayfinder:research
status: open
---

## Question

Where should the Frameshare hosted tier run — Railway, Fly.io, or Vercel + Neon + Cloudflare R2 — given Next.js + PostgreSQL + S3-compatible storage + Sharp.js image processing, targeting a free/low-cost hosted instance for photographers?

Research should surface:
- Cost at ~100 active users (storage, egress, compute) for each platform
- Whether Sharp.js (native binary) works on each platform without custom build steps
- PostgreSQL managed offering quality and free tier on each (Railway Postgres, Neon, Fly Postgres)
- S3-compatible storage options: Cloudflare R2 (free egress), Backblaze B2, Tigris (Fly-native) — which pairs best with each platform
- Docker Compose compatibility: can self-hosters run the same Compose file locally that powers the hosted version, or do they diverge?
- Cold start / always-on requirements — Sharp.js processing needs a warm server
- Custom domain support for frameshare.app

## Resolution

**Recommendation: Railway (Hobby plan) + Cloudflare R2**

Estimated monthly cost at 100 active users: **$10–18/month** all-in.

---

### Platform Comparison

#### Railway (recommended)

- **Compute**: Hobby plan is $5/month subscription + $5 usage credit included. A Next.js container (0.5 vCPU / 512 MB RAM) always-on runs ~$3–5/month of that credit. No cold starts — Railway runs persistent containers, not serverless functions.
- **PostgreSQL**: Railway Postgres (Hobby) is metered at ~$0.000231/GB-hour RAM and ~$0.000463/vCPU-hour, plus $0.25/GB storage. A small idle DB costs roughly $2–5/month. No built-in connection pooler (PgBouncer must be self-managed or swapped for Neon — see note below).
- **Sharp.js**: Works without issue. Railway deploys Docker containers; `sharp` and `libvips` install normally via `npm install sharp` in the Dockerfile. No special build flags needed.
- **Storage**: Pair with Cloudflare R2 — zero egress, $0.015/GB stored. At 100 users with ~10 GB of photos: ~$0.15/month storage + negligible operations cost. Attach via standard S3 SDK (`@aws-sdk/client-s3` with R2 endpoint).
- **Custom domain**: Full CNAME + auto-provisioned Let's Encrypt SSL. Point `frameshare.app` CNAME to the Railway service URL + add the TXT verification record. Works out of the box.
- **Always-on**: Yes. Railway containers stay up continuously; no scale-to-zero unless you explicitly configure it. Sharp image processing is warm on every request.
- **Docker Compose parity**: Railway uses `railway.toml` / Dockerfile, not Compose. Self-hosters can still use `docker-compose.yml` locally — the same Dockerfile powers both. Minor divergence: Railway injects env vars via its dashboard rather than `.env`; document this in `SELF_HOSTING.md`.

**Caveats**: Railway Postgres has no built-in pgBouncer. At 100 users this is fine (Next.js connection count is bounded). If connection count becomes an issue later, add Neon as the DB layer (keep Railway for compute) — this is a one-line `DATABASE_URL` swap.

There are community reports of Railway volume/Postgres data-loss bugs on older versions; use Railway's managed Postgres (not a volume mount) and keep a daily `pg_dump` to R2 as a precaution.

---

#### Fly.io

- **Compute**: No free tier as of 2024. A single shared-cpu-1x / 256 MB Machine always-on costs ~$1.94/month; a realistic Next.js app needs at least 512 MB RAM → ~$3–4/month. Fly Postgres (one Machine + volume) adds another ~$3–5/month. Total: ~$8–15/month, comparable to Railway.
- **Sharp.js**: Works in Docker containers. `fly.toml` + Dockerfile approach is identical to Railway. Fly's official Next.js template (`github.com/nextjs/deploy-fly`) includes `npm i sharp` in the Dockerfile.
- **Storage**: Tigris is Fly-native (`fly storage create`). Billed through Fly invoice, no separate account. Tigris pricing: $0.02/GB stored, zero egress, 5 GB free/month. Slightly pricier per GB than R2 but zero ops overhead if already on Fly.
- **Custom domain**: Supported via `fly certs add frameshare.app`. Auto-TLS.
- **Always-on**: Yes, same as Railway — persistent VMs.
- **Why not chosen**: DX is rougher (flyctl CLI, `fly.toml` quirks). Less documentation for Next.js + Postgres specifically. Railway is simpler for the Frameshare use case and has comparable cost.

---

#### Vercel + Neon + Cloudflare R2

- **Compute**: Vercel Hobby (free) or Pro ($20/month). Hobby bans commercial use. Pro is $20/month base + function invocation charges.
- **Sharp.js**: **Problematic.** Vercel's serverless runtime strips native binaries; `libvips-cpp.so` fails to load at runtime (confirmed active issues in `lovell/sharp` repo as of 2025–2026, e.g., issue #4567). Next.js's built-in `next/image` optimization uses Sharp internally and works on Vercel because Vercel controls that execution environment — but custom Sharp calls in API routes / server actions fail unless you route them to a separate container. Workaround (deploy image-processing route to Railway/Fly, keep Next.js on Vercel) adds operational complexity that defeats the point.
- **PostgreSQL (Neon)**: Best-in-class for serverless. Free tier: 0.5 GB storage, 100 compute-hours/month, scale-to-zero. Built-in PgBouncer pooler (up to 10,000 client connections via pooled endpoint). Paid: usage-based, ~$0.106/CU-hour. At 100 users: essentially free or <$5/month.
- **Storage (R2)**: $0.015/GB stored, zero egress. Best-fit for Vercel because Cloudflare CDN fronts both.
- **Cold starts**: Vercel Fluid Compute (launched 2025) reduces cold start frequency but does not eliminate them. Sharp processing on a cold function will add 1–3 s latency on first request. For a photo gallery this is noticeable.
- **Why not chosen**: Sharp.js native binary incompatibility with Vercel serverless is a hard blocker for custom image processing. Vercel Pro at $20/month is also the most expensive base cost of the three options.

---

### Decision Matrix

| Criterion | Railway + R2 | Fly.io + Tigris | Vercel Pro + Neon + R2 |
|---|---|---|---|
| Est. monthly cost (100 users) | $10–18 | $10–18 | $25–35 |
| Sharp.js works out of the box | Yes (Docker) | Yes (Docker) | No (libvips stripped) |
| Always-on (no cold start) | Yes | Yes | Partial (Fluid Compute) |
| Managed Postgres free tier | No (metered) | No (metered) | Yes (Neon free) |
| Built-in connection pooling | No (add Neon if needed) | No | Yes (Neon pgBouncer) |
| Storage egress cost | $0 (R2) | $0 (Tigris) | $0 (R2) |
| Custom domain + TLS | Yes | Yes | Yes |
| DX / deploy simplicity | High | Medium | High |
| Docker Compose self-host parity | Yes (same Dockerfile) | Yes (same Dockerfile) | No (serverless runtime diverges) |

---

### Chosen Stack

**Railway Hobby ($5/month plan) + Cloudflare R2**

- Deploy Next.js as a Docker container on Railway (standalone Next.js build, `sharp` installed in Dockerfile).
- Railway Postgres for development/staging; consider swapping to Neon on the paid Launch plan ($19/month) if connection pooling or branching becomes valuable.
- Cloudflare R2 for photo storage — zero egress, works with any S3 SDK, no Cloudflare account lock-in.
- Custom domain: CNAME `frameshare.app` → Railway service URL.

**Estimated monthly cost at 100 active users:**
- Railway Hobby subscription: $5
- Railway compute overage (Next.js container, always-on): ~$3–5
- Railway Postgres (small): ~$2–5
- Cloudflare R2 (10 GB photos, moderate ops): ~$0.50–1
- **Total: ~$10–16/month**

Scale path: when the app outgrows Railway Postgres reliability or needs branching, swap `DATABASE_URL` to Neon (same schema, zero code changes). When compute needs grow, upgrade to Railway Pro or migrate the Dockerfile to Fly.io — same Dockerfile, different `fly.toml`.

---

*Resolved: 2026-08-08*
