// Shared, editor-facing explanations of what alt text is, so the guidance reads
// the same on every image and video upload. Surfaced via the `admin.description`
// of the required `alt` fields on the media collection (payload.config.ts) and
// the Videos collection (collections/Videos.ts).

export const ALT_TEXT_IMAGE_DESCRIPTION =
  'Alt text is a short written description of this image. Screen readers read it ' +
  'aloud for people who can’t see the image, and browsers show it if the image ' +
  'fails to load. Describe what the image shows and why it matters here — e.g. ' +
  '“Founder presenting the new bakery brand on stage” — not the file name or the ' +
  'word “image”. (Required.)'

export const ALT_TEXT_VIDEO_DESCRIPTION =
  'Alt text is a short description of this video for people using screen readers ' +
  'and as a fallback when the clip can’t play. Describe what the clip shows and ' +
  'its purpose — e.g. “Time-lapse of the bakery storefront being built over three ' +
  'days”. One clear sentence is plenty. (Required.)'
