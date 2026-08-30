# Frameshare handoff

## Status — 2026-08-30

The current working tree contains a completed security and reliability
hardening pass. It is intentionally **not committed**. Preserve the existing
changes and do not reset or discard the worktree.

The deployment target is **Vercel for the application** and **Neon for
Postgres**. Railway was legacy configuration and `railway.toml` has been
deleted. Docker Compose remains an optional local-development stack; Vercel
does not use it.

## Required before deployment

1. Make the R2/S3 bucket private. Application routes now protect masters and
   download policy, but a public bucket can still bypass that policy through a
   direct object URL.
2. Apply the tracked Drizzle migrations to the intended Neon database from a
   trusted local machine or CI job:

   ```powershell
   npm run db:migrate
   ```

   Do not run migrations automatically from a Vercel request. Confirm
   `DATABASE_URL` points at the correct Neon branch first.
3. Configure the usual Vercel environment variables: `DATABASE_URL`,
   `AUTH_SECRET`, S3/R2 credentials, and email credentials. `RATE_LIMIT_SECRET`
   is optional and falls back to `AUTH_SECRET`; `GEMINI_API_KEY` is optional.

## Completed hardening

### Storage and gallery access

- `POST /api/upload/put` only accepts the authenticated user's pending photo
  and its exact permitted `originalKey`; it can no longer proxy writes to an
  arbitrary known object key.
- Public gallery payloads no longer include master/original or watermark keys.
  Normal viewing uses authorized thumbnail/display routes only.
- `/api/s3/[...key]` resolves a key through the photo record and blocks public
  access to masters, originals, and watermarked assets. Authorized downloads
  select an appropriate original or low-resolution variant server-side.
- Public stars, comments, and selections share an expiry/password/ownership
  gate and validate that the referenced photo belongs to the gallery.
- `maxSelections` is enforced atomically while starring and submitting.

### Upload integrity and quota

- Proofing processing keeps the original private master, so later final edits
  render from the master rather than a resized/watermarked preview.
- Quota reservation uses a conditional database update inside the transaction;
  concurrent uploads cannot oversubscribe it.
- Processing verifies the uploaded object size, reconciles the reservation,
  and leaves failures retryable. Stale incomplete uploads are cleaned on a
  later upload attempt by the same user.
- Existing records whose masters were deleted by the old behavior cannot be
  restored automatically and must be re-uploaded.

### Database and operational fixes

- Runtime `ALTER TABLE` code and the legacy migration script were removed.
  Schema changes are now tracked through Drizzle.
- Added gallery query indexes for photos, stars, and comments.
- `next.config.ts` has Turbopack root configured; standalone output and Docker
  support remain local-only and do not affect Vercel deployments.
- Removed all Railway references.

### Selection and prototype abuse controls

- A selection now stores `clientId`, has a unique `(gallery_id, client_id)`
  constraint, and treats retries as successful idempotent responses without
  sending another notification email.
- Selection requests are limited to three per hour per gallery and
  privacy-preserving HMAC'd visitor IP. Raw IP addresses are not stored.
- `/prototype` and `/api/prototype/analyze` require authentication. Analysis
  requests are limited to 12 per user per hour, accept only JPEG/PNG/WebP data
  URLs, cap image/request size, and no longer return internal provider errors.
  A signed-in user may still supply their own Gemini key; server keys never
  reach the browser.

## New migrations

- `drizzle/0002_loud_corsair.sql`: former runtime columns and gallery indexes.
- `drizzle/0003_polite_captain_midlands.sql`: selection client identity,
  idempotency constraint, and selection rate-limit table. It safely backfills
  existing selection records before making `client_id` required.
- `drizzle/0004_lush_daimon_hellstrom.sql`: authenticated prototype analysis
  rate-limit table.

The corresponding `drizzle/meta` snapshots and journal entries are present.

## Verification completed

- Targeted ESLint for every newly changed route, schema, proxy, and analyzer:
  passed.
- `npx tsc --noEmit`: passed.
- `npm run db:generate`: reports no schema changes.
- `npm run build`: passed on Next.js 16.3.0.

`npm run lint` remains noisy with pre-existing unrelated findings; it was not
used as the acceptance gate for this pass.

## Remaining priority work

1. **Durable processing jobs.** RAW processing and ZIP creation still execute
   inside request handlers and can time out or duplicate work. Design this for
   Vercel + Neon: a Postgres-backed job table, a Vercel Cron-triggered worker,
   S3/R2 artifacts for generated ZIPs, explicit retry/idempotency/progress,
   and UI polling. Do not introduce Railway.
2. Add automated authorization, quota/failure-recovery, and gallery lifecycle
   tests, plus CI.
3. Review production dependency advisories in Auth.js/next-auth beta and
   Nodemailer before release.

## Vercel and Neon access

The user reported connecting Vercel and Neon through MCP. This running session
did not receive those tools (`codex mcp list` only showed local runtime tools),
so a fresh Codex session should first verify the connections before using them.
Use a Neon development branch and require confirmation for every database or
deployment write.
