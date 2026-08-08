---
label: wayfinder:grilling
status: closed
blocks: T05-database-schema
---

## Resolution

**Drizzle.** SQL-first, no binary engine, lighter Docker image, natural fit for the raw SQL expressions needed in quota tracking (`sql\`storage_used + ${fileSize}\``) and status enums. Migrations via `drizzle-kit generate` + `drizzle-kit migrate`.

## Question

Which ORM should Frameshare use — Prisma or Drizzle — and what are the trade-offs that matter for this specific project?

Frameshare's DB needs: user accounts, galleries, photos (with S3 keys + metadata), stars, comments, selection submissions. PostgreSQL. Deployed on Docker Compose (self-hosted) and a managed cloud DB (hosted tier). Schema will evolve as post-MVP features land.

Key axes:
- **Prisma**: mature, great DX, generates a client, migration tooling is solid, heavier runtime (~30 MB), some edge runtime friction with Next.js.
- **Drizzle**: lightweight, SQL-first, excellent TypeScript inference, works well in edge/serverless, migrations are manual-ish, smaller community.

This decision blocks T05 (database schema prototype).
