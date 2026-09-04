CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"summary" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"acreage" numeric NOT NULL,
	"county" text NOT NULL,
	"state" text NOT NULL,
	"goals" jsonb NOT NULL,
	"boundary" jsonb,
	"wooded_acres" numeric,
	"open_acres" numeric,
	"soil_type" text,
	"water_features" jsonb,
	"ecosystem_score" numeric,
	"insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" text,
	"current_period_end" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"why_it_matters" text NOT NULL,
	"location_description" text,
	"impact_score" numeric NOT NULL,
	"impact_breakdown" jsonb NOT NULL,
	"recommendations" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"month" text,
	"season" text,
	"tier" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plans_property_id_idx" ON "plans" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "properties_clerk_user_id_idx" ON "properties" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "tasks_plan_id_idx" ON "tasks" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "tasks_property_id_idx" ON "tasks" USING btree ("property_id");