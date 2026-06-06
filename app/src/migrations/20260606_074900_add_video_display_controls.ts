import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_videos_display_size" AS ENUM('small', 'medium', 'large', 'full');
  CREATE TYPE "public"."enum_videos_display_alignment" AS ENUM('center', 'left', 'right');
  ALTER TABLE "videos" ADD COLUMN "display_size" "enum_videos_display_size" DEFAULT 'full';
  ALTER TABLE "videos" ADD COLUMN "display_alignment" "enum_videos_display_alignment" DEFAULT 'center';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "videos" DROP COLUMN "display_size";
  ALTER TABLE "videos" DROP COLUMN "display_alignment";
  DROP TYPE "public"."enum_videos_display_size";
  DROP TYPE "public"."enum_videos_display_alignment";`)
}
