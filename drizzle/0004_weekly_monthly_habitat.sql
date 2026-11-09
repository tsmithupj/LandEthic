CREATE TABLE "habitat_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"food_plots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"food_plot_note" text,
	"nesting_boxes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nesting_box_note" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habitat_plans_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "last_monthly_update" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "monthly_note" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "week" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "steps" jsonb;--> statement-breakpoint
ALTER TABLE "habitat_plans" ADD CONSTRAINT "habitat_plans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;