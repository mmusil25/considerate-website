import * as migration_20260526_000858 from './20260526_000858';
import * as migration_20260526_170948_add_media_s3_prefix from './20260526_170948_add_media_s3_prefix';
import * as migration_20260601_051234 from './20260601_051234';
import * as migration_20260604_120107_add_videos_and_seo from './20260604_120107_add_videos_and_seo';
import * as migration_20260606_060712_add_advisors_locations from './20260606_060712_add_advisors_locations';
import * as migration_20260606_074900_add_video_display_controls from './20260606_074900_add_video_display_controls';

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
    name: '20260601_051234',
  },
  {
    up: migration_20260604_120107_add_videos_and_seo.up,
    down: migration_20260604_120107_add_videos_and_seo.down,
    name: '20260604_120107_add_videos_and_seo',
  },
  {
    up: migration_20260606_060712_add_advisors_locations.up,
    down: migration_20260606_060712_add_advisors_locations.down,
    name: '20260606_060712_add_advisors_locations',
  },
  {
    up: migration_20260606_074900_add_video_display_controls.up,
    down: migration_20260606_074900_add_video_display_controls.down,
    name: '20260606_074900_add_video_display_controls'
  },
];
