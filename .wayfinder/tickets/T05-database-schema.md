---
label: wayfinder:prototype
status: closed
blocked-by: T01-orm-choice, T02-upload-strategy, T03-image-processing
---

## Resolution

Schema approved. Key decisions:
- `stars` tracks `clientId` (anonymous UUID from localStorage) — enables unstar. Unique index on `(photoId, clientId)`.
- `selections` stores snapshot array of `photoIds` at submit time (not FK join) — protects against photo deletion post-submit.
- `photos.status` enum (`pending/ready/error`) — galleries only surface `ready` photos.
- `users.storageUsedBytes` incremented at presigned-URL sign-time, decremented on delete.
- `galleries.slug` — random URL-safe slug, share URL: `frameshare.app/g/{slug}`.
- Per-gallery branding overrides on `galleries` table; null = fall through to account defaults on `users`.

## Question

What is the core database schema for Frameshare — all entities, fields, and relationships — before any code is written?

Entities known from product decisions:
- **User** (photographer): account, storage quota tracking, branding (logo S3 key, accent color)
- **Gallery**: belongs to user, shareable slug, optional password hash, optional expiry, download mode (none/lowres/full), per-gallery branding override
- **Photo**: belongs to gallery, S3 keys (original + variants), metadata (filename, size, mime type, dimensions), sort order
- **Star**: client starred a photo (no client account — identified by session/cookie or just gallery-scoped)
- **Comment**: per photo, text, created_at, no client account (photographer posts as themselves; client comments are anonymous or name-tagged?)
- **Selection**: a "Submit selection" event — links to gallery, timestamp, starred photo set snapshot
- **Session / account**: Auth.js tables

This ticket resolves once a schema prototype is reviewed and approved. Blocked until ORM (T01), upload strategy (T02), and image processing (T03) are decided — their answers affect pending-upload state, variant key storage, and quota tracking fields.
