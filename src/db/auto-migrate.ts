import { db } from "@/db"
import { sql } from "drizzle-orm"

let migrated = false

export async function ensureColumnsMigrated() {
  if (migrated) return
  try {
    await db.execute(sql`
      ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "stage" text NOT NULL DEFAULT 'proofing';
      ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "max_selections" integer;
      ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "section" text NOT NULL DEFAULT 'proofing';
    `)
    migrated = true
  } catch (err) {
    console.warn("Auto-migrate warning (columns may already exist):", err)
  }
}
