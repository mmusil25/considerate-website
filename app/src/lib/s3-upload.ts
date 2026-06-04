import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Shared S3 client for the video upload flow. Mirrors the credential/endpoint
 * resolution used by the s3Storage plugin in payload.config.ts so the SAME code
 * talks to MinIO locally and real S3 (via the ECS task role) in production.
 */
let cachedClient: S3Client | null = null

export function getS3Client(): S3Client {
  if (cachedClient) return cachedClient
  cachedClient = new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    ...(process.env.AWS_ACCESS_KEY_ID && {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    }),
    ...(process.env.S3_ENDPOINT && {
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
    }),
  })
  return cachedClient
}

export function getBucket(): string {
  const bucket = process.env.S3_BUCKET
  if (!bucket) throw new Error('S3_BUCKET is not configured')
  return bucket
}

export const VIDEO_SOURCE_PREFIX = process.env.VIDEO_SOURCE_PREFIX || 'videos/source/'
export const VIDEO_HLS_PREFIX = process.env.VIDEO_HLS_PREFIX || 'videos/hls/'

/** Strip path separators and odd characters from a user-provided filename. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'video'
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'video'
}

/**
 * Start a multipart upload for a source video and return the uploadId + key.
 * The object lands under VIDEO_SOURCE_PREFIX/<videoId>/<filename>; the S3
 * ObjectCreated event on that prefix triggers the transcode Lambda.
 */
export async function createMultipart(
  videoId: string,
  filename: string,
  contentType: string,
): Promise<{ uploadId: string; key: string }> {
  const key = `${VIDEO_SOURCE_PREFIX}${videoId}/${sanitizeFilename(filename)}`
  const res = await getS3Client().send(
    new CreateMultipartUploadCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType || 'application/octet-stream',
    }),
  )
  if (!res.UploadId) throw new Error('S3 did not return an UploadId')
  return { uploadId: res.UploadId, key }
}

/** Presign a single UploadPart URL the browser PUTs a chunk to. */
export async function signUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600,
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: getBucket(),
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  })
  return getSignedUrl(getS3Client(), command, { expiresIn })
}

/** Finalize the multipart upload once all parts are uploaded. */
export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: CompletedPart[],
): Promise<void> {
  await getS3Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: getBucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        // S3 requires parts sorted by PartNumber.
        Parts: [...parts].sort((a, b) => (a.PartNumber || 0) - (b.PartNumber || 0)),
      },
    }),
  )
}

/** Abort a multipart upload (cleanup on failure/cancel). */
export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  await getS3Client().send(
    new AbortMultipartUploadCommand({ Bucket: getBucket(), Key: key, UploadId: uploadId }),
  )
}
