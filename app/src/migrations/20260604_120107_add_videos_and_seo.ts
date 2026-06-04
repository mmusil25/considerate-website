import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_technologies_category" AS ENUM('language', 'framework', 'tool', 'platform', 'database', 'service', 'other');
  CREATE TYPE "public"."enum_site_settings_availability_status" AS ENUM('available', 'limited', 'unavailable');
  CREATE TYPE "public"."enum_videos_status" AS ENUM('empty', 'uploading', 'processing', 'ready', 'error');
  CREATE TYPE "public"."enum_projects_structured_data_schema_type" AS ENUM('CreativeWork', 'WebApplication', 'SoftwareSourceCode', 'Service');
  CREATE TABLE "technologies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"url" varchar,
  	"category" "enum_technologies_category",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"organization_name" varchar NOT NULL,
  	"organization_description" varchar,
  	"logo_id" integer,
  	"founding_date" timestamp(3) with time zone,
  	"address" varchar,
  	"email" varchar,
  	"telephone" varchar,
  	"person_given_name" varchar NOT NULL,
  	"person_family_name" varchar NOT NULL,
  	"person_job_title" varchar,
  	"person_bio" varchar,
  	"person_image_id" integer,
  	"linkedin_url" varchar,
  	"github_url" varchar,
  	"hourly_rate" varchar,
  	"availability_status" "enum_site_settings_availability_status" DEFAULT 'available',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"technologies_id" integer
  );
  
  CREATE TABLE "videos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"status" "enum_videos_status" DEFAULT 'empty',
  	"source_key" varchar,
  	"source_mime_type" varchar,
  	"hls_manifest_key" varchar,
  	"poster_key" varchar,
  	"media_convert_job_id" varchar,
  	"duration_ms" numeric,
  	"width" numeric,
  	"height" numeric,
  	"error_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "projects_structured_data_keywords_focused" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar
  );
  
  ALTER TABLE "projects_technologies" ADD COLUMN "tech_id" integer;
  ALTER TABLE "projects" ADD COLUMN "project_video_id" integer;
  ALTER TABLE "projects" ADD COLUMN "structured_data_schema_type" "enum_projects_structured_data_schema_type" DEFAULT 'CreativeWork' NOT NULL;
  ALTER TABLE "projects" ADD COLUMN "structured_data_outcomes" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "technologies_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "site_settings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "videos_id" integer;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_person_image_id_media_id_fk" FOREIGN KEY ("person_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_technologies_fk" FOREIGN KEY ("technologies_id") REFERENCES "public"."technologies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_structured_data_keywords_focused" ADD CONSTRAINT "projects_structured_data_keywords_focused_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "technologies_name_idx" ON "technologies" USING btree ("name");
  CREATE INDEX "technologies_updated_at_idx" ON "technologies" USING btree ("updated_at");
  CREATE INDEX "technologies_created_at_idx" ON "technologies" USING btree ("created_at");
  CREATE INDEX "site_settings_logo_idx" ON "site_settings" USING btree ("logo_id");
  CREATE INDEX "site_settings_person_image_idx" ON "site_settings" USING btree ("person_image_id");
  CREATE INDEX "site_settings_updated_at_idx" ON "site_settings" USING btree ("updated_at");
  CREATE INDEX "site_settings_created_at_idx" ON "site_settings" USING btree ("created_at");
  CREATE INDEX "site_settings_rels_order_idx" ON "site_settings_rels" USING btree ("order");
  CREATE INDEX "site_settings_rels_parent_idx" ON "site_settings_rels" USING btree ("parent_id");
  CREATE INDEX "site_settings_rels_path_idx" ON "site_settings_rels" USING btree ("path");
  CREATE INDEX "site_settings_rels_technologies_id_idx" ON "site_settings_rels" USING btree ("technologies_id");
  CREATE INDEX "videos_updated_at_idx" ON "videos" USING btree ("updated_at");
  CREATE INDEX "videos_created_at_idx" ON "videos" USING btree ("created_at");
  CREATE INDEX "projects_structured_data_keywords_focused_order_idx" ON "projects_structured_data_keywords_focused" USING btree ("_order");
  CREATE INDEX "projects_structured_data_keywords_focused_parent_id_idx" ON "projects_structured_data_keywords_focused" USING btree ("_parent_id");
  ALTER TABLE "projects_technologies" ADD CONSTRAINT "projects_technologies_tech_id_technologies_id_fk" FOREIGN KEY ("tech_id") REFERENCES "public"."technologies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_project_video_id_videos_id_fk" FOREIGN KEY ("project_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_technologies_fk" FOREIGN KEY ("technologies_id") REFERENCES "public"."technologies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_settings_fk" FOREIGN KEY ("site_settings_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_technologies_tech_idx" ON "projects_technologies" USING btree ("tech_id");
  CREATE INDEX "projects_project_video_idx" ON "projects" USING btree ("project_video_id");
  CREATE INDEX "payload_locked_documents_rels_technologies_id_idx" ON "payload_locked_documents_rels" USING btree ("technologies_id");
  CREATE INDEX "payload_locked_documents_rels_site_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("site_settings_id");
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("videos_id");
  ALTER TABLE "projects_technologies" DROP COLUMN "tech";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "technologies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_structured_data_keywords_focused" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "technologies" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "site_settings_rels" CASCADE;
  DROP TABLE "videos" CASCADE;
  DROP TABLE "projects_structured_data_keywords_focused" CASCADE;
  ALTER TABLE "projects_technologies" DROP CONSTRAINT "projects_technologies_tech_id_technologies_id_fk";
  
  ALTER TABLE "projects" DROP CONSTRAINT "projects_project_video_id_videos_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_technologies_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_site_settings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_videos_fk";
  
  DROP INDEX "projects_technologies_tech_idx";
  DROP INDEX "projects_project_video_idx";
  DROP INDEX "payload_locked_documents_rels_technologies_id_idx";
  DROP INDEX "payload_locked_documents_rels_site_settings_id_idx";
  DROP INDEX "payload_locked_documents_rels_videos_id_idx";
  ALTER TABLE "projects_technologies" ADD COLUMN "tech" varchar;
  ALTER TABLE "projects_technologies" DROP COLUMN "tech_id";
  ALTER TABLE "projects" DROP COLUMN "project_video_id";
  ALTER TABLE "projects" DROP COLUMN "structured_data_schema_type";
  ALTER TABLE "projects" DROP COLUMN "structured_data_outcomes";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "technologies_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "site_settings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "videos_id";
  DROP TYPE "public"."enum_technologies_category";
  DROP TYPE "public"."enum_site_settings_availability_status";
  DROP TYPE "public"."enum_videos_status";
  DROP TYPE "public"."enum_projects_structured_data_schema_type";`)
}
