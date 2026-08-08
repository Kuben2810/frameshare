---
label: wayfinder:map
---

## Destination

A production-ready MVP of Frameshare shipped as a Docker Compose self-hosted package and a free hosted instance — photo gallery sharing and client proofing for photographers, with gallery creation, client starring/selection, per-photo comments, three-way download controls with server-side watermarking, and branded presentation mode.

## Notes

Stack: Next.js + PostgreSQL + S3-compatible storage + Docker Compose. Email via Resend (hosted) / SMTP env var (self-hosted). Auth: email+password + optional Google OAuth via Auth.js. UI: Tailwind + shadcn/ui (decided, no ticket). Multi-tenancy: row-level app isolation in shared PostgreSQL (decided, no ticket).

Consult /prototype for schema and UI work, /research for infrastructure questions, /grilling and /domain-modeling for any open decisions.

## Open tickets

**Frontier: empty — the way is clear.**

## Decisions so far

- [Grilling session — all product decisions](tickets/T00-grilling-session.md) — Full MVP scope, stack, auth, gallery structure, client workflow, download controls, branding, hosted limits all resolved in one grilling session.
- [Upload strategy](tickets/T02-upload-strategy.md) — Presigned PUT URL (browser → S3 directly). No server proxy. `@aws-sdk/client-s3` + `getSignedUrl`. Quota checked before signing; pending photo row inserted at sign-time, confirmed via HeadObject after client upload completes.
- [Hosted deployment platform](tickets/T04-hosted-platform.md) — Railway Hobby ($5/month) + Cloudflare R2. ~$10–16/month at 100 users. Sharp.js works (Docker containers, no native binary stripping). Always-on, no cold starts. Same Dockerfile powers Railway and local docker-compose.yml.
- [Image processing strategy](tickets/T03-image-processing.md) — Pre-generate 3 variants at upload time (thumb 400px WebP, display 2048px WebP, watermarked 1200px JPEG). SVG text overlay watermark via Sharp composite. `node:20-slim` Docker base (not Alpine — musl/glibc mismatch). Sharp in API route, not server action. Bypass `next/image`; serve variants as direct S3 URLs.
- [ORM choice](tickets/T01-orm-choice.md) — Drizzle. SQL-first, no binary engine, `drizzle-kit` migrations.
- [Database schema](tickets/T05-database-schema.md) — 6 tables: users, accounts, sessions, galleries, photos, stars, comments, selections. Stars track anonymous `clientId` (localStorage UUID) for unstar support. Selections store photo ID snapshot at submit time.

## Not yet specified

- Rate limiting and abuse detection for the hosted tier
- Email template design
- CI/CD pipeline and release process
- Analytics/monitoring for hosted instance
- Onboarding flow for new photographers
- Mobile responsiveness requirements

## Out of scope

- Folders/sub-albums in galleries
- Real-time updates (WebSocket/SSE) — refresh-based for MVP
- RAW and video file support
- Custom domain per photographer
- Team/multi-photographer accounts
- Lightroom/Capture One plugin integration
