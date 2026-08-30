CREATE TABLE IF NOT EXISTS "selection_rate_limits" (
	"gallery_id" text NOT NULL,
	"visitor_hash" text NOT NULL,
	"window_started_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "selection_rate_limits_gallery_id_visitor_hash_pk" PRIMARY KEY("gallery_id","visitor_hash")
);
--> statement-breakpoint
ALTER TABLE "selections" ADD COLUMN IF NOT EXISTS "client_id" text;--> statement-breakpoint
UPDATE "selections" SET "client_id" = CONCAT('legacy:', "id") WHERE "client_id" IS NULL;--> statement-breakpoint
ALTER TABLE "selections" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "selection_rate_limits" ADD CONSTRAINT "selection_rate_limits_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "selections_gallery_client_idx" ON "selections" USING btree ("gallery_id","client_id");
