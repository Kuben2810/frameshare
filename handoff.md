# Frameshare handoff

## Current operational status - 2026-08-31

Frameshare is deployed on Vercel with Neon Postgres and a private Cloudflare
R2 bucket. The production health endpoint is live at
`https://frameshare-three.vercel.app/api/health` and returns `{"ok":true}`.

- `master` and `dev` are intentionally identical at commit `24ecb21`.
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
- The storage-foundation work is on `feature/storage-foundation` only. Its
  `0006` migration has been applied and verified on the Neon `development`
  branch, not production. It gives every existing workspace the Studio
  entitlement (250 GiB) and an active private Frameshare-managed connection;
  every existing gallery now has an explicit connection assignment.
- This branch has passed `npx tsc --noEmit`, `npx drizzle-kit check`, and the
  Vercel-mode production build. The Drive upload acceptance test completed at
  commit `440c4ed` (deploy `dpl_6eCPHi7DufdcN142Dxvi3b4hDkm8`), verified on
  the preview at
  `https://frameshare-git-feature-storage-7a509d-kuben2810-8156s-projects.vercel.app`.
  It has not been merged or deployed to production.
- The same branch now contains an unmerged Google Drive storage slice:
  separate storage OAuth, encrypted credentials, owner-only Google Picker
  folder verification, direct resumable original uploads, Drive-backed
  processing/variants, private delivery/downloads, edits, and cleanup.
  A verified Drive connection can be the default for future galleries only;
  existing gallery assignments remain immutable. Drive cannot be disconnected
  while a gallery uses it.
- Google Drive is configured for this branch's Preview environment only. The
  isolated Google Cloud project is `frameshare-storage`; Google Drive API and
  Google Picker API are enabled. Its External OAuth app remains in Testing,
  and its test-user list, web OAuth client, authorised origin, and redirect
  callback are restricted to the feature preview alias above.
- Preview-only Vercel variables now include the Drive OAuth client settings,
  encrypted-credential and OAuth-state keys, and the Picker browser key. The
  Picker key is restricted to Google Picker API and that preview host. It also
  has `NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID`, set to the Google Cloud project
  number; this is required by Google Picker when using the narrow `drive.file`
  scope. No production Vercel environment variable, production deployment, or
  Neon production branch was changed.
- Deployment `dpl_7phUs2Zh6gbFtxMHUvEBuhxyJ3Ru` is READY and backs the feature
  preview alias. Vercel deployment protection remains enabled.
- The feature preview now uses the Neon `development` branch rather than the
  production branch. A dedicated empty Drive test folder was created and
  selected through Google Picker. After reauthorising, the folder verification
  and `Use Drive for New Galleries` action both succeeded. The test workspace
  now defaults only *future* galleries to Drive; its existing gallery remains
  on Frameshare-managed storage. Commit `06ea635` authorised the browser
  upload; commit `36f4828` releases a failed upload's quota reservation
  immediately; commit `440c4ed` replaced the direct googleapis.com PUT (blocked
  by CORS) with a same-origin relay at `/api/upload/drive-relay` that completes
  the upload server-to-server. The full acceptance test (upload → processing →
  client view → deletion/quota reconciliation) passed on 2026-09-01.
- Before a production rollout, create separate production OAuth and Picker
  credentials, add the real production domain and public legal links to the
  Google consent screen, decide whether to publish/verify the OAuth app, and
  add the `drive.file` scope through Google Auth Platform's Data Access page.

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
  failures retryable, cleans stale incomplete uploads on later attempts, and
  now releases a failed browser upload's reservation immediately.
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
- On the current Drive slice, `npm run build` and `npx tsc --noEmit` passed
  after the browser-upload authorization and cleanup changes. The deployed
  preview was tested through OAuth, folder selection, server-side folder
  verification, persisted default-provider selection, relay upload, Sharp
  processing, watermark generation, private client view, and
  deletion/quota-reconciliation. All steps passed on 2026-09-01.

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

## Next implementation slice

The Google Drive connection, Picker folder binding, and future-gallery default
are verified in Preview. Before a production rollout, create separate
production OAuth/Picker credentials, configure the production callback and
`NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID`, add public legal links, and decide whether
to publish/verify the OAuth app. The generic Google sign-in OAuth callback is
separate from this storage OAuth flow and still needs its own production
configuration.

The Drive upload acceptance test is complete. Before treating Drive as
production ready, verify durable-job failure recovery and then create separate
production OAuth/Picker credentials, configure the production callback and
`NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID`, add public legal links, and decide whether
to publish/verify the OAuth app.

The supporting workspace/onboarding specification remains in
[`docs/phase-1-workspace-onboarding.md`](docs/phase-1-workspace-onboarding.md).
