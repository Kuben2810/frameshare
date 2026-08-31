CREATE TABLE "storage_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'needs_connection' NOT NULL,
	"root_reference" text,
	"credentials_ciphertext" text,
	"last_checked_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "storage_plan" text DEFAULT 'trial' NOT NULL;
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "storage_quota_bytes" bigint DEFAULT 5368709120 NOT NULL;
--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "storage_connection_id" text;
--> statement-breakpoint
UPDATE "workspaces"
SET
  "storage_plan" = 'studio',
  "storage_quota_bytes" = 268435456000,
  "storage_provider" = 'managed';
--> statement-breakpoint
INSERT INTO "storage_connections" (
  "id", "workspace_id", "provider", "label", "status", "last_checked_at", "created_at", "updated_at"
)
SELECT
  'managed:' || "id", "id", 'managed', 'Frameshare managed storage', 'active', NOW(), NOW(), NOW()
FROM "workspaces"
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "galleries"
SET "storage_connection_id" = 'managed:' || "workspace_id"
WHERE "storage_connection_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "galleries" ALTER COLUMN "storage_connection_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "storage_connections" ADD CONSTRAINT "storage_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "storage_connections_workspace_provider_idx" ON "storage_connections" USING btree ("workspace_id","provider");
--> statement-breakpoint
CREATE INDEX "storage_connections_workspace_status_idx" ON "storage_connections" USING btree ("workspace_id","status");
--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_storage_connection_id_storage_connections_id_fk" FOREIGN KEY ("storage_connection_id") REFERENCES "public"."storage_connections"("id") ON DELETE no action ON UPDATE no action;
