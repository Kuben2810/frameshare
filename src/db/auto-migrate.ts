import { db } from "@/db"
import { sql } from "drizzle-orm"

let migrationPromise: Promise<void> | null = null

export async function ensureColumnsMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      try {
        await db.execute(sql`
          ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "stage" text NOT NULL DEFAULT 'proofing';
          ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "max_selections" integer;
          ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "section" text NOT NULL DEFAULT 'proofing';
          ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "blur_hash" text;
          ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "edit_recipe" text;
          ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "source_photo_id" text;
        `)
      } catch (err) {
        console.warn("Auto-migrate warning:", err)
      }
    })()
  }
  return migrationPromise
}
