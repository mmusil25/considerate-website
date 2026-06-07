import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // `alt` is a required field, so the generated migration was a plain
  // `ADD COLUMN ... NOT NULL` — which fails on any row that already exists (no
  // default to fill it). Add the column nullable, backfill existing assets with
  // an empty string (a valid, non-null "decorative / not described yet" value),
  // then enforce NOT NULL. The `required: true` field config forces editors to
  // supply real alt text the next time each existing asset is saved.
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "alt" varchar;
  UPDATE "media" SET "alt" = '' WHERE "alt" IS NULL;
  ALTER TABLE "media" ALTER COLUMN "alt" SET NOT NULL;
  ALTER TABLE "videos" ADD COLUMN "alt" varchar;
  UPDATE "videos" SET "alt" = '' WHERE "alt" IS NULL;
  ALTER TABLE "videos" ALTER COLUMN "alt" SET NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP COLUMN "alt";
  ALTER TABLE "videos" DROP COLUMN "alt";`)
}
