CREATE TABLE IF NOT EXISTS "ledge_conditions" (
	"ledge_id" uuid NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"source_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hs_m" double precision,
	"tp_s" double precision,
	"swell_dir_deg" double precision,
	"current_speed_ms" double precision,
	"current_dir_deg" double precision,
	"tide_height_cm" double precision,
	"tide_rate_cm_per_hr" double precision,
	"wave_load" double precision,
	"current_load" double precision,
	"tide_modulation_factor" double precision,
	"lli" double precision,
	"r2_estimate_m" double precision,
	"danger_flag" boolean,
	"danger_tier" text,
	"data_complete" boolean GENERATED ALWAYS AS ((hs_m is not null and tp_s is not null and swell_dir_deg is not null and current_speed_ms is not null and current_dir_deg is not null and tide_height_cm is not null)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledge_conditions_ledge_id_ts_pk" PRIMARY KEY("ledge_id","ts")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"area" text NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"facing_bearing" double precision NOT NULL,
	"platform_height_m" double precision NOT NULL,
	"slope_estimate" double precision,
	"safety_margin" double precision DEFAULT 0.7 NOT NULL,
	"is_declared_hazard" boolean DEFAULT false NOT NULL,
	"height_verified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"geog" "geography(Point,4326)" GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledges_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledge_conditions" ADD CONSTRAINT "ledge_conditions_ledge_id_ledges_id_fk" FOREIGN KEY ("ledge_id") REFERENCES "public"."ledges"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledge_conditions_ts_idx" ON "ledge_conditions" USING btree ("ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledge_conditions_danger_idx" ON "ledge_conditions" USING btree ("ts") WHERE danger_flag;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledges_geog_gix" ON "ledges" USING gist ("geog");