import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_cache_control_on_save_projects" AS ENUM('cdn', 'origin', 'none');
  CREATE TYPE "public"."enum_cache_control_on_save_videos" AS ENUM('cdn', 'origin', 'none');
  CREATE TYPE "public"."enum_cache_control_on_save_advisors" AS ENUM('cdn', 'origin', 'none');
  CREATE TYPE "public"."enum_cache_control_on_save_locations" AS ENUM('cdn', 'origin', 'none');
  CREATE TABLE "cache_control" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"on_save_projects" "enum_cache_control_on_save_projects" DEFAULT 'cdn',
  	"on_save_videos" "enum_cache_control_on_save_videos" DEFAULT 'cdn',
  	"on_save_advisors" "enum_cache_control_on_save_advisors" DEFAULT 'cdn',
  	"on_save_locations" "enum_cache_control_on_save_locations" DEFAULT 'cdn',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cache_control" CASCADE;
  DROP TYPE "public"."enum_cache_control_on_save_projects";
  DROP TYPE "public"."enum_cache_control_on_save_videos";
  DROP TYPE "public"."enum_cache_control_on_save_advisors";
  DROP TYPE "public"."enum_cache_control_on_save_locations";`)
}
