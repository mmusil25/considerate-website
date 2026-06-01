import * as migration_20260526_000858 from './20260526_000858';
import * as migration_20260526_170948_add_media_s3_prefix from './20260526_170948_add_media_s3_prefix';
import * as migration_20260601_051234 from './20260601_051234';

export const migrations = [
  {
    up: migration_20260526_000858.up,
    down: migration_20260526_000858.down,
    name: '20260526_000858',
  },
  {
    up: migration_20260526_170948_add_media_s3_prefix.up,
    down: migration_20260526_170948_add_media_s3_prefix.down,
    name: '20260526_170948_add_media_s3_prefix',
  },
  {
    up: migration_20260601_051234.up,
    down: migration_20260601_051234.down,
    name: '20260601_051234'
  },
];
