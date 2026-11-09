CREATE TABLE "species_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"property_id" uuid,
	"thumbnail" text,
	"common_name" text NOT NULL,
	"scientific_name" text,
	"iconic_taxon" text,
	"score" numeric,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "species_ids" ADD CONSTRAINT "species_ids_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "species_ids_user_created_idx" ON "species_ids" USING btree ("clerk_user_id","created_at");