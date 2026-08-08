---
label: wayfinder:grilling
status: closed
---

## Question

What is Frameshare — its MVP scope, target users, hosting model, tech stack, and all core product decisions — so a wayfinder map can be charted?

## Resolution

All product decisions resolved in grilling session. Summary:

**Identity:** Frameshare — free, open-source picdrop alternative. OSS repo + free hosted tier (Plausible/Umami model).

**MVP features:** Gallery creation + shareable link (no client login) · Client photo starring + optional "Submit selection" → email notification · Per-photo comments (photographer-visible only) · Three-way download control: none / low-res (corner watermark, photographer name) / full-res · Branded presentation mode: grid + slideshow toggle, per-account logo + accent color (overridable per-gallery).

**Stack:** Next.js + PostgreSQL + S3-compatible storage + Docker Compose (all-in-one default, env vars for external services). Auth.js: email+password + optional Google OAuth. Email: Resend (hosted) / SMTP env var (self-hosted). UI: Tailwind + shadcn/ui.

**Gallery:** Flat (no folders), manual drag-and-drop reordering, JPEG/PNG/TIFF/WebP, 50 MB/file max, optional password + expiry on links.

**Hosted tier:** 10 GB storage cap per account, no gallery count limit.

**Multi-tenancy:** Row-level app isolation in shared PostgreSQL.

**Out of scope for MVP:** Folders, real-time updates, RAW/video, custom domain, team accounts, Lightroom/Capture One.
