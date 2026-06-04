// Video transcode pipeline Lambda.
//
// One function, two triggers:
//   1. S3 ObjectCreated under videos/source/<id>/ → start a MediaConvert HLS job.
//   2. EventBridge "MediaConvert Job State Change" (COMPLETE|ERROR) → POST the app
//      webhook so the Payload Video doc flips to ready/error.
//
// Uses the @aws-sdk that ships with the nodejs20.x runtime (no bundling) and the
// runtime's global fetch for the webhook call.

import {
  MediaConvertClient,
  DescribeEndpointsCommand,
  CreateJobCommand,
} from '@aws-sdk/client-mediaconvert'

const REGION = process.env.AWS_REGION
const ROLE = process.env.MEDIACONVERT_ROLE_ARN
const QUEUE = process.env.MEDIACONVERT_QUEUE
const BUCKET = process.env.ASSETS_BUCKET
const HLS_PREFIX = process.env.HLS_PREFIX || 'videos/hls/'
const WEBHOOK_URL = process.env.APP_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

// MediaConvert has an account-specific endpoint; discover once and cache.
let cachedEndpoint = null
async function mcClient() {
  if (!cachedEndpoint) {
    const probe = new MediaConvertClient({ region: REGION })
    const res = await probe.send(new DescribeEndpointsCommand({}))
    cachedEndpoint = res.Endpoints?.[0]?.Url
  }
  return new MediaConvertClient({ region: REGION, endpoint: cachedEndpoint })
}

export const handler = async (event) => {
  if (event?.Records?.[0]?.s3) return handleS3(event)
  if (event?.source === 'aws.mediaconvert' || event?.['detail-type'] === 'MediaConvert Job State Change') {
    return handleJobStateChange(event)
  }
  console.log('Unrecognized event:', JSON.stringify(event))
}

async function handleS3(event) {
  for (const rec of event.Records) {
    const key = decodeURIComponent(rec.s3.object.key.replace(/\+/g, ' '))
    // Expect videos/source/<videoId>/<filename>
    const match = key.match(/^videos\/source\/([^/]+)\//)
    if (!match) {
      console.log('Key does not match source prefix, skipping:', key)
      continue
    }
    const videoId = match[1]
    const hlsKey = `${HLS_PREFIX}${videoId}/index.m3u8`
    const posterKey = `${HLS_PREFIX}${videoId}/poster.0000000.jpg`

    const client = await mcClient()
    const res = await client.send(
      new CreateJobCommand({
        Role: ROLE,
        Queue: QUEUE,
        StatusUpdateInterval: 'SECONDS_60',
        // Echoed back on the Job State Change event so we can map it to the doc.
        UserMetadata: { videoId, hlsKey, posterKey },
        Settings: buildJobSettings(
          `s3://${BUCKET}/${key}`,
          `s3://${BUCKET}/${HLS_PREFIX}${videoId}/index`,
          `s3://${BUCKET}/${HLS_PREFIX}${videoId}/poster`,
        ),
      }),
    )
    console.log(`Started MediaConvert job ${res.Job?.Id} for video ${videoId}`)
  }
}

async function handleJobStateChange(event) {
  const detail = event.detail || {}
  const meta = detail.userMetadata || {}
  const videoId = meta.videoId
  if (!videoId) {
    console.log('Job event without videoId metadata, ignoring')
    return
  }

  let body
  if (detail.status === 'COMPLETE') {
    body = { videoId, status: 'ready', hlsManifestKey: meta.hlsKey, posterKey: meta.posterKey }
  } else if (detail.status === 'ERROR') {
    body = {
      videoId,
      status: 'error',
      errorMessage: detail.errorMessage || `MediaConvert error ${detail.errorCode ?? ''}`.trim(),
    }
  } else {
    return // ignore PROGRESSING/STATUS_UPDATE/etc.
  }

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
    body: JSON.stringify(body),
  })
  console.log(`Webhook POST ${WEBHOOK_URL} → ${res.status} for video ${videoId} (${detail.status})`)
}

// HLS ladder via MediaConvert Automated ABR: the ladder is generated FROM the
// source — it never upscales, the top rung mirrors source quality, framerate
// follows source, and MaxAbrBitrate caps the ceiling (~16 Mbps ≈ 2160p). Audio is
// AAC (HLS/Safari-compatible). A frame-capture output writes the poster.
// These encode params are plain data — tune here without touching infra.
function buildJobSettings(input, hlsDestination, posterDestination) {
  return {
    TimecodeConfig: { Source: 'ZEROBASED' },
    Inputs: [
      {
        FileInput: input,
        TimecodeSource: 'ZEROBASED',
        VideoSelector: {},
        AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' } },
      },
    ],
    OutputGroups: [
      {
        Name: 'HLS',
        AutomatedEncodingSettings: {
          AbrSettings: { MaxAbrBitrate: 16000000, MaxRenditions: 6, MinAbrBitrate: 600000 },
        },
        OutputGroupSettings: {
          Type: 'HLS_GROUP_SETTINGS',
          HlsGroupSettings: {
            Destination: hlsDestination,
            SegmentLength: 6,
            MinSegmentLength: 0,
            SegmentControl: 'SEGMENTED_FILES',
            ManifestDurationFormat: 'INTEGER',
            OutputSelection: 'MANIFESTS_AND_SEGMENTS',
          },
        },
        Outputs: [
          {
            ContainerSettings: { Container: 'M3U8', M3u8Settings: {} },
            VideoDescription: {
              CodecSettings: {
                Codec: 'H_264',
                H264Settings: {
                  RateControlMode: 'QVBR',
                  SceneChangeDetect: 'TRANSITION_DETECTION',
                  FramerateControl: 'INITIALIZE_FROM_SOURCE',
                  GopSizeUnits: 'AUTO',
                },
              },
            },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: 'AAC',
                  AacSettings: { Bitrate: 192000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
                },
              },
            ],
            OutputSettings: { HlsSettings: {} },
          },
        ],
      },
      {
        Name: 'Poster',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: { Destination: posterDestination },
        },
        Outputs: [
          {
            ContainerSettings: { Container: 'RAW' },
            VideoDescription: {
              CodecSettings: {
                Codec: 'FRAME_CAPTURE',
                FrameCaptureSettings: {
                  FramerateNumerator: 1,
                  FramerateDenominator: 1,
                  MaxCaptures: 1,
                  Quality: 80,
                },
              },
            },
          },
        ],
      },
    ],
  }
}
