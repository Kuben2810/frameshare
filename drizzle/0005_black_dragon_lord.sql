CREATE TABLE "workspace_members" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_key" text,
	"accent_color" text,
	"storage_provider" text DEFAULT 'managed' NOT NULL,
	"storage_used_bytes" bigint DEFAULT 0 NOT NULL,
	"onboarding_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "workspace_id" text;--> statement-breakpoint
INSERT INTO "workspaces" (
	"id",
	"name",
	"slug",
	"logo_key",
	"accent_color",
	"storage_provider",
	"storage_used_bytes",
	"onboarding_completed_at",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	COALESCE(NULLIF(BTRIM("name"), ''), 'My Studio'),
	'studio-' || REPLACE(LOWER("id"), '-', ''),
	"logo_key",
	"accent_color",
	'managed',
	"storage_used_bytes",
	NOW(),
	"created_at",
	NOW()
FROM "users"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
SELECT "id", "id", 'owner'
FROM "users"
ON CONFLICT ("workspace_id", "user_id") DO NOTHING;--> statement-breakpoint
UPDATE "galleries"
SET "workspace_id" = "user_id"
WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "galleries" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_members_user_workspace_idx" ON "workspace_members" USING btree ("user_id","workspace_id");--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "galleries_workspace_created_idx" ON "galleries" USING btree ("workspace_id","created_at");
