import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  type SendMessageCommandInput,
} from "@aws-sdk/client-sqs"

export const sqsClient = new SQSClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export const QUEUES = {
  REVIEW_INGESTION: process.env.SQS_REVIEW_INGESTION_URL!,
  NLP_TAGGING:      process.env.SQS_NLP_TAGGING_URL!,
  AI_DRAFT:         process.env.SQS_AI_DRAFT_URL!,
} as const

export type QueueName = keyof typeof QUEUES

// ─── Message Types ───────────────────────────────────────────────────────────

export interface ReviewIngestionMessage {
  tenantId:  string
  sourceId:  string
  platform:  string
  rawReview: Record<string, unknown>
}

export interface NlpTaggingMessage {
  tenantId: string
  reviewId: string
}

export interface AiDraftMessage {
  tenantId:   string
  reviewId:   string
  aiProvider: "CLAUDE" | "OPENAI"
}

// ─── Producers ───────────────────────────────────────────────────────────────

export async function enqueue<T extends object>(
  queue: QueueName,
  message: T,
  delaySeconds = 0,
): Promise<void> {
  const input: SendMessageCommandInput = {
    QueueUrl:     QUEUES[queue],
    MessageBody:  JSON.stringify(message),
    DelaySeconds: delaySeconds,
    MessageAttributes: {
      ContentType: {
        DataType:    "String",
        StringValue: "application/json",
      },
    },
  }
  await sqsClient.send(new SendMessageCommand(input))
}

export async function enqueueBatch<T extends object>(
  queue: QueueName,
  messages: T[],
): Promise<void> {
  // SQS batch max = 10
  const chunks = chunkArray(messages, 10)
  for (const chunk of chunks) {
    await sqsClient.send(
      new SendMessageBatchCommand({
        QueueUrl: QUEUES[queue],
        Entries:  chunk.map((msg, i) => ({
          Id:          String(i),
          MessageBody: JSON.stringify(msg),
        })),
      }),
    )
  }
}

// ─── Consumer helpers (used by Lambda handlers) ───────────────────────────────

export async function receiveMessages(queue: QueueName, maxMessages = 10) {
  const result = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl:            QUEUES[queue],
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds:     20, // long polling
    }),
  )
  return result.Messages ?? []
}

export async function deleteMessage(queue: QueueName, receiptHandle: string) {
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl:      QUEUES[queue],
      ReceiptHandle: receiptHandle,
    }),
  )
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  )
}
