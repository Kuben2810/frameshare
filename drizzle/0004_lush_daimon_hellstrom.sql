CREATE TABLE "prototype_analysis_rate_limits" (
	"user_id" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prototype_analysis_rate_limits" ADD CONSTRAINT "prototype_analysis_rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;