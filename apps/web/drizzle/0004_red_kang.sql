CREATE TABLE IF NOT EXISTS "coastline_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledge_id" uuid NOT NULL,
	"path" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledges" ADD COLUMN "shore_lat" double precision;--> statement-breakpoint
ALTER TABLE "ledges" ADD COLUMN "shore_lon" double precision;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coastline_segments" ADD CONSTRAINT "coastline_segments_ledge_id_ledges_id_fk" FOREIGN KEY ("ledge_id") REFERENCES "public"."ledges"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coastline_segments_ledge_idx" ON "coastline_segments" USING btree ("ledge_id");