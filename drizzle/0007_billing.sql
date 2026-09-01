-- Rename storage_plan → plan, update enum values, add billing columns
ALTER TABLE "workspaces" RENAME COLUMN "storage_plan" TO "plan";--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "plan_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "plan_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "payfast_token" text;--> statement-breakpoint

-- Migrate old plan values to new enum
UPDATE "workspaces" SET "plan" = 'free'   WHERE "plan" = 'trial';--> statement-breakpoint
UPDATE "workspaces" SET "plan" = 'pro'    WHERE "plan" = 'byo_storage';--> statement-breakpoint
-- 'studio' stays as 'studio'

-- Align quota bytes with plan defaults for existing rows
UPDATE "workspaces" SET "storage_quota_bytes" = 2147483648   WHERE "plan" = 'free';--> statement-breakpoint
UPDATE "workspaces" SET "storage_quota_bytes" = 32212254720  WHERE "plan" = 'solo';--> statement-breakpoint
UPDATE "workspaces" SET "storage_quota_bytes" = 107374182400 WHERE "plan" = 'pro';--> statement-breakpoint
UPDATE "workspaces" SET "storage_quota_bytes" = 268435456000 WHERE "plan" = 'studio';--> statement-breakpoint

-- Update default for new free-tier workspaces
ALTER TABLE "workspaces" ALTER COLUMN "storage_quota_bytes" SET DEFAULT 2147483648;
