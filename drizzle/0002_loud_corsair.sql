ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "stage" text DEFAULT 'proofing' NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "max_selections" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "section" text DEFAULT 'proofing' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "blur_hash" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "edit_recipe" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "source_photo_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_photo_created_idx" ON "comments" USING btree ("photo_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_gallery_status_sort_idx" ON "photos" USING btree ("gallery_id","status","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stars_gallery_client_idx" ON "stars" USING btree ("gallery_id","client_id");
