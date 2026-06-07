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
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'

const REGION = process.env.AWS_REGION
const ROLE = process.env.MEDIACONVERT_ROLE_ARN
const QUEUE = process.env.MEDIACONVERT_QUEUE
const BUCKET = process.env.ASSETS_BUCKET
const HLS_PREFIX = process.env.HLS_PREFIX || 'videos/hls/'
const WEBHOOK_URL = process.env.APP_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

const s3 = new S3Client({ region: REGION })

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

    // The app stamps the editor's "remove audio" choice as object metadata on the
    // source upload (see app/src/lib/s3-upload.ts). Read it back to decide whether
    // the HLS job carries an audio track. Default to keeping audio if the head
    // fails for any reason.
    let removeAudio = false
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
      removeAudio = head.Metadata?.removeaudio === 'true'
    } catch (e) {
      console.log('HeadObject failed; keeping audio:', e?.message || e)
    }

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
          { removeAudio },
        ),
      }),
    )
    console.log(
      `Started MediaConvert job ${res.Job?.Id} for video ${videoId}${removeAudio ? ' (audio removed)' : ''}`,
    )
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
// follows source, and MaxAbrBitrate caps the ceiling (~28 Mbps ≈ 2160p). Audio is
// AAC (HLS/Safari-compatible). A frame-capture output writes the poster.
// These encode params are plain data — tune here without touching infra.
function buildJobSettings(input, hlsDestination, posterDestination, { removeAudio = false } = {}) {
  return {
    TimecodeConfig: { Source: 'ZEROBASED' },
    Inputs: [
      {
        FileInput: input,
        TimecodeSource: 'ZEROBASED',
        // Rotate: AUTO honors the source's rotation metadata. Phone videos shot
        // in portrait are stored as landscape pixels + a 90° rotation flag;
        // without this, MediaConvert bakes the sideways pixels and the clip
        // plays rotated 90°. AUTO applies the flag so portrait stays portrait.
        VideoSelector: { Rotate: 'AUTO' },
        // When removing audio, declare no audio selector at all — the output
        // below carries no AudioDescriptions, so the HLS renditions are silent.
        ...(removeAudio ? {} : { AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' } } }),
      },
    ],
    OutputGroups: [
      {
        Name: 'HLS',
        AutomatedEncodingSettings: {
          // NOTE (verified 2026-06-06): MinAbrBitrate does NOT raise real quality
          // on "easy"/low-complexity content. QVBR still targets the same average
          // (~1.5 Mbps for a 4K screen recording); a high floor just caps the PEAK
          // and collapses the ladder to a single rung (killing adaptivity + the
          // player's quality menu). Neither MinAbrBitrate nor QvbrQualityLevel
          // (rejected, see H264Settings note) raises Automated-ABR quality — the
          // only real lever is a MANUAL fixed-bitrate ladder. Left at 600k so the
          // ladder stays multi-rung; the player opens on the top rung anyway
          // (testBandwidth:false + high estimate in VideoPlayer.tsx).
          AbrSettings: { MaxAbrBitrate: 28000000, MaxRenditions: 6, MinAbrBitrate: 600000 },
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
                  // NOTE: QvbrSettings/QvbrQualityLevel is REJECTED under Automated ABR
                  // ("Unexpected property qvbrSettings") — automated ABR controls the
                  // QVBR quality target itself. To raise quality on "easy" content
                  // (e.g. screen recordings that come out ~1.5 Mbps @ 4K) the only
                  // levers are MinAbrBitrate (floor, above) or abandoning automated ABR
                  // for a manual ladder. Do NOT add QvbrSettings here.
                  // Automated ABR REQUIRES an explicit HQ tuning level; without it
                  // CreateJob is rejected 400 ("qualityTuningLevel is a required
                  // property"). MULTI_PASS_HQ matches the preserve-source-quality policy.
                  QualityTuningLevel: 'MULTI_PASS_HQ',
                  SceneChangeDetect: 'TRANSITION_DETECTION',
                  FramerateControl: 'INITIALIZE_FROM_SOURCE',
                  GopSizeUnits: 'AUTO',
                },
              },
            },
            // Omit audio entirely when the editor asked for a silent video;
            // otherwise AAC for HLS/Safari compatibility.
            ...(removeAudio
              ? {}
              : {
                  AudioDescriptions: [
                    {
                      CodecSettings: {
                        Codec: 'AAC',
                        AacSettings: { Bitrate: 192000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
                      },
                    },
                  ],
                }),
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
