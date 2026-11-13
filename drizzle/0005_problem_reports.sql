CREATE TABLE "problem_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text,
	"email" text,
	"tier" text,
	"page" text,
	"message" text,
	"error" text,
	"details" jsonb,
	"ip_hash" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "problem_reports_created_idx" ON "problem_reports" USING btree ("created_at");