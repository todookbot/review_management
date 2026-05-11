import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.S3_BUCKET_NAME!

/**
 * Store raw review payload in S3.
 * Returns the S3 key for DB storage.
 */
export async function storeRawPayload(
  tenantId: string,
  platform: string,
  reviewId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const key = `raw-reviews/${tenantId}/${platform}/${reviewId}.json`
  await s3Client.send(
    new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        JSON.stringify(payload, null, 2),
      ContentType: "application/json",
      Metadata: {
        tenantId,
        platform,
        reviewId,
      },
    }),
  )
  return key
}

/**
 * Fetch raw payload from S3.
 */
export async function getRawPayload(s3Key: string): Promise<Record<string, unknown>> {
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
  )
  const body = await result.Body?.transformToString()
  return JSON.parse(body ?? "{}")
}

/**
 * Get a presigned URL for temporary access (e.g. exports).
 */
export async function getPresignedUrl(s3Key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
    { expiresIn: expiresInSeconds },
  )
}

export async function deleteObject(s3Key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }))
}
