CREATE TYPE "public"."confidence" AS ENUM('verified', 'approximate', 'community');--> statement-breakpoint
CREATE TYPE "public"."object_category" AS ENUM('sleeping', 'kitchen', 'seating', 'storage', 'utility', 'electrical', 'water');--> statement-breakpoint
CREATE TYPE "public"."object_kind" AS ENUM('fixed', 'articulated', 'loose');--> statement-breakpoint
CREATE TYPE "public"."obstacle_kind" AS ENUM('wheel_well', 'b_pillar', 'aperture_side', 'aperture_rear', 'mount_point', 'intrusion');--> statement-breakpoint
CREATE TYPE "public"."unit_system" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TABLE "project_objects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "object_category" NOT NULL,
	"kind" "object_kind" NOT NULL,
	"pos_x" integer NOT NULL,
	"pos_y" integer NOT NULL,
	"pos_z" integer NOT NULL,
	"size_w" integer NOT NULL,
	"size_d" integer NOT NULL,
	"size_h" integer NOT NULL,
	"yaw" real DEFAULT 0 NOT NULL,
	"mass" integer DEFAULT 0 NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"color" text NOT NULL,
	"articulation" jsonb,
	"connections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"z_index" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"van_model_id" text,
	"custom_interior_w" integer,
	"custom_interior_d" integer,
	"custom_interior_h" integer,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"height_mm" integer,
	"unit_system" "unit_system" DEFAULT 'metric' NOT NULL,
	"disabled_rules" text[] DEFAULT '{}' NOT NULL,
	"grid_mm" integer DEFAULT 10 NOT NULL,
	"ghosting_enabled" boolean DEFAULT true NOT NULL,
	"snap_to_objects" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "van_models" (
	"id" text PRIMARY KEY NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"variant" text DEFAULT '' NOT NULL,
	"wheelbase_label" text NOT NULL,
	"roof_label" text NOT NULL,
	"interior_w" integer NOT NULL,
	"interior_d" integer NOT NULL,
	"interior_h" integer NOT NULL,
	"taper" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload" integer NOT NULL,
	"gvwr" integer NOT NULL,
	"front_axle_y" integer NOT NULL,
	"rear_axle_y" integer NOT NULL,
	"kerb_front_axle" integer NOT NULL,
	"kerb_rear_axle" integer NOT NULL,
	"confidence" "confidence" DEFAULT 'approximate' NOT NULL,
	"source_note" text
);
--> statement-breakpoint
CREATE TABLE "van_obstacles" (
	"id" text PRIMARY KEY NOT NULL,
	"van_model_id" text NOT NULL,
	"kind" "obstacle_kind" NOT NULL,
	"name" text NOT NULL,
	"pos_x" integer NOT NULL,
	"pos_y" integer NOT NULL,
	"pos_z" integer NOT NULL,
	"size_w" integer NOT NULL,
	"size_d" integer NOT NULL,
	"size_h" integer NOT NULL,
	"articulation" jsonb,
	"confidence" "confidence" DEFAULT 'approximate' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_objects" ADD CONSTRAINT "project_objects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_van_model_id_van_models_id_fk" FOREIGN KEY ("van_model_id") REFERENCES "public"."van_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "van_obstacles" ADD CONSTRAINT "van_obstacles_van_model_id_van_models_id_fk" FOREIGN KEY ("van_model_id") REFERENCES "public"."van_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_objects_project_idx" ON "project_objects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_external_id_idx" ON "users" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "van_obstacles_model_idx" ON "van_obstacles" USING btree ("van_model_id");