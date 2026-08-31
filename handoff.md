# Frameshare handoff

## Current operational status - 2026-08-31

Frameshare is deployed on Vercel with Neon Postgres and a private Cloudflare
R2 bucket. The production health endpoint is live at
`https://frameshare-three.vercel.app/api/health` and returns `{"ok":true}`.

- `master` and `dev` are intentionally identical at commit `95633f5`.
- Production and preview Vercel deployments are ready.
- Both the production and `development` Neon branches have the Phase 1A
  workspace migration (`0005`) applied. Backfill verification found 2
  workspaces, 2 owner memberships, and all 3 existing galleries attached to
  a workspace on each branch.
- The R2 bucket's public `r2.dev` URL is disabled and no custom domain is
  attached. The bucket CORS policy permits only the active Vercel production
  origins and local development (`localhost:3000` and `localhost:3005`) for
  `GET`, `PUT`, and `HEAD`.
- Vercel production and preview environments already contain database,
  authentication, R2/S3, and email configuration. `RATE_LIMIT_SECRET` and
  `GEMINI_API_KEY` remain optional.

## Deployment notes

- Vercel must use its native Next.js output tracing. `next.config.ts` keeps
  `output: "standalone"` for Docker/local deployments, but omits it when
  `VERCEL` is set. This avoids Vercel's post-build missing
  `next-server.js.nft.json` error.
- Railway is legacy only. `railway.toml` has been deleted; do not reintroduce
  Railway for workers or scheduled work.
- Docker Compose remains an optional local-development path.
- Before any future production database or deployment write, verify the
  intended Neon branch/environment and obtain user confirmation.

## Completed hardening

### Storage and gallery access

- Uploads can only write the authenticated user's pending photo and its exact
  permitted original key.
- Public gallery payloads and object routes do not expose original/master or
  watermark keys. Authorized application routes determine the allowed variant.
- Public stars, comments, and selections share expiry, password, and ownership
  gates; referenced photos must belong to the target gallery.
- Selection limits are enforced atomically.

### Upload integrity and operational safety

- Private masters are retained for later final edits.
- Quota reservation is conditional and transaction-safe under concurrency.
- Processing verifies uploaded object size, reconciles reservations, keeps
  failures retryable, and cleans stale incomplete uploads on later attempts.
- Existing records whose masters were deleted by the old behavior cannot be
  restored automatically and must be re-uploaded.
- Runtime schema mutation was removed. Schema changes are tracked by Drizzle.
- Gallery query indexes and rate limiting for selections/prototype analysis
  have been added.

### Selection and prototype abuse controls

- A selection records `clientId`, has a unique `(gallery_id, client_id)`
  constraint, and treats retries as idempotent without sending a second email.
- Selection requests are limited to three per hour per gallery using an HMAC'd
  visitor IP; raw IP addresses are not stored.
- `/prototype` and `/api/prototype/analyze` require authentication. Analysis
  is limited to 12 requests per user per hour, accepts only JPEG/PNG/WebP data
  URLs within request/image-size limits, and does not return internal provider
  errors. A signed-in user may provide their own Gemini key; server keys never
  reach the browser.

### Migrations

- `drizzle/0002_loud_corsair.sql`: former runtime columns and gallery indexes.
- `drizzle/0003_polite_captain_midlands.sql`: selection client identity,
  idempotency constraint, and selection rate-limit table.
- `drizzle/0004_lush_daimon_hellstrom.sql`: authenticated prototype-analysis
  rate-limit table.
- `drizzle/0005_black_dragon_lord.sql`: workspace and membership tables,
  workspace gallery ownership, and a safe backfill for existing accounts.
  Applied and verified on both development and production on 2026-08-31.

## Verification record

- Targeted ESLint for the hardened routes, schema, proxy, and analyzer passed.
- `npx tsc --noEmit` and `npm run db:generate` passed at the hardening point.
- `npm run build` passed locally on Next.js 16.3.0, including a Vercel-mode
  build after the output-tracing fix.
- For Phase 1A, `npx drizzle-kit check`, `npx tsc --noEmit`, and the Vercel
  production build passed before the development database migration.
- Production deployment `e664cd3` is READY on Vercel; canonical health and an
  existing public gallery returned HTTP 200 after release.
- The full `npm run lint` remains noisy with pre-existing unrelated findings;
  it was not used as the acceptance gate for the hardening pass.

## Product brief - recommended direction

### Product position

Frameshare should be a **client proofing and delivery workspace for independent
photographers**, not a generic image gallery or a storage product.

The promise:

> Send a polished gallery, collect client selections and approvals quickly,
> and deliver final work under the photographer's own brand.

The founder's personal workflow should remain the primary dogfooding account,
but it should run through the same workspace product that customers use. Do
not maintain a separate personal product and SaaS product.

### Initial customer

Focus the first sellable version on solo portrait, wedding, and event
photographers. They have a repeated, high-value workflow:

`create gallery -> share -> client reviews/selects -> photographer approves -> deliver`

Do not initially position for every type of visual creative, enterprise DAM,
or self-hosted installations.

### What Frameshare sells

The commercial value is less client chasing and a more professional,
branded delivery experience. Storage flexibility supports that sale but is
not the headline.

The client should experience the photographer's brand, not need to understand
Frameshare.

### Storage strategy

Keep Frameshare-managed storage as the zero-setup default. Add storage choice
as a trust and upgrade feature:

1. Managed storage (existing private R2-backed default).
2. Google Drive connection for photographers already organised around Drive.
3. S3-compatible bring-your-own storage: R2, Amazon S3, Backblaze, Wasabi.
4. Consider Dropbox/OneDrive only after real customer demand validates them.

Do not build gallery code around direct R2 URLs. Every workspace should have a
storage provider binding behind a common asset-storage interface. S3-compatible
providers may use presigned browser uploads; Google Drive will require its own
authenticated/resumable upload path. Gallery authorization must remain enforced
by Frameshare regardless of where originals are stored.

### Sellable v1 capabilities

- Workspace onboarding that ends in a shareable first gallery, not a settings
  checklist.
- Client proofing: favourites/stars, selections, comments, approvals, due
  dates, and a clear client call to action.
- Photographer workflow: gallery status, client activity, reminders, and a
  review queue for pending/approved/change-requested work.
- Delivery controls: expiry, password protection, watermarking, download size,
  limits, and final-download delivery.
- Brand controls: logo, cover, colours, branded emails, and a custom subdomain.
- Subscription plans, usage limits, Stripe checkout, and Stripe's customer
  billing portal/invoices.

### Suggested plans

- **Trial:** a limited first gallery and managed storage; prove the value loop.
- **Solo:** normal proofing workflow and branded galleries.
- **Pro:** automations, larger limits, Google Drive/S3 connections, and deeper
  branding.
- **Studio:** team roles, custom domains, shared branding, and client history.

Exact prices and limits should be decided only after interviews and an initial
value/retention signal.

### First-run experience

Target a first shareable gallery in under ten minutes:

1. Create a workspace and brand name.
2. Add logo, colours, and reply-to email (skippable initially).
3. Choose managed storage or connect a provider.
4. Start from a gallery template and upload/import photos.
5. Invite a client or copy a share link.

Include a demo gallery so a new photographer can see the finished client
experience before investing in setup.

## Implementation plan - do not start without a new scoped task

### Phase 0: validate the wedge (one week, no major build)

- Interview 8-12 target photographers using a prototype/demo.
- Test the product promise, pricing language, storage objection, and which
  proofing step causes the most client chasing.
- Define the first paid plan only after these conversations.
- Add or select privacy-safe product analytics for activation and retention.

**Exit criterion:** clear evidence that photographers will share a gallery and
pay to reduce proofing/admin work.

### Phase 1: sellable foundation (roughly 2-3 weeks)

- Introduce a tenant-safe `Workspace` model, workspace membership/roles, and
  ownership migration strategy for existing personal data.
- Build the guided onboarding and demo gallery.
- Make branding workspace-scoped: name, logo, colours, email sender settings.
- Define plans, feature flags, usage limits, and usage metering. Integrate
  Stripe Checkout, webhooks, billing portal, and invoice links.
- Instrument: signup, first gallery created/shared, first client visit,
  selection submitted, completed gallery, and upgrade.

**Exit criterion:** a new photographer can create, brand, share, and pay for
a gallery without manual operator help.

### Phase 2: proofing workflow moat (roughly 2-4 weeks)

- Gallery status model and client activity timeline.
- Selection/approval submission and photographer review queue.
- Deadline/reminder notifications with idempotent delivery records.
- Delivery settings and final-download workflow.
- Gallery templates for portrait, wedding, and event use cases.

**Exit criterion:** a photographer can run a complete client proofing cycle
without leaving Frameshare.

### Phase 3: storage provider abstraction (roughly 2-4 weeks)

- Define a provider contract: upload target, read/download stream, object
  metadata, delete, copy/move, and health/credential validation.
- Keep existing private R2 as the managed provider implementation.
- Add workspace storage connections and encrypted credential handling.
- Implement Google Drive import/upload first; then S3-compatible BYO storage.
- Add provider setup diagnostics, migration/import progress, and clear
failure recovery.

**Exit criterion:** a Pro customer can connect a provider and use it for a
new gallery without weakening existing access control.

### Phase 4: studio product (after paying-user signal)

- Team invitations and roles.
- Custom domains and advanced brand controls.
- Client history/CRM-lite, reusable templates, and automation rules.
- Optional provider expansion only where customer demand warrants it.

## Technical prerequisites before product phases

1. **Durable jobs first.** RAW processing, ZIP creation, reminders, provider
   imports, and billing-webhook retries must not run solely in request handlers.
   Use a Postgres-backed job table, idempotency keys, retry/backoff, progress,
   and Vercel Cron-triggered workers. Store generated ZIP artifacts in private
   S3/R2; do not introduce Railway.
2. Add automated authorization, quota/failure-recovery, gallery lifecycle,
   and storage-provider contract tests, then CI.
3. Review production dependency advisories in Auth.js/next-auth beta and
   Nodemailer before widening access.
4. Establish secrets policy before provider connections: encrypted-at-rest
   credentials, key rotation, revocation, and no secret values in logs.

## Success metrics

- Time from signup to first shared gallery.
- Share invite to first client visit.
- Client visit to submitted selection/approval.
- Completed galleries per active photographer.
- 30-day photographer retention and trial-to-paid conversion.
- Storage connection adoption and related support volume.

## Immediate next decision

Before implementation, confirm the initial customer as **solo portrait,
wedding, and event photographers**, then turn Phase 1 into a separately
scoped design/build task with data-model and screen-level acceptance criteria.

The resulting Phase 1A specification is in
[`docs/phase-1-workspace-onboarding.md`](docs/phase-1-workspace-onboarding.md).
It deliberately scopes the first implementation to workspace ownership,
onboarding, branding, and managed-storage quota; billing and external storage
providers remain later work.
