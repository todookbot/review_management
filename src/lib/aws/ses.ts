import {
  SESClient,
  SendEmailCommand,
} from "@aws-sdk/client-ses"

export const sesClient = new SESClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const FROM    = process.env.SES_FROM_EMAIL!
const REPLY_TO = process.env.SES_REPLY_TO!

interface EmailPayload {
  to:       string | string[]
  subject:  string
  htmlBody: string
  textBody: string
}

async function sendEmail({ to, subject, htmlBody, textBody }: EmailPayload) {
  const toAddresses = Array.isArray(to) ? to : [to]
  await sesClient.send(
    new SendEmailCommand({
      Source:           FROM,
      ReplyToAddresses: [REPLY_TO],
      Destination:      { ToAddresses: toAddresses },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: { Data: textBody, Charset: "UTF-8" },
        },
      },
    }),
  )
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export async function sendNewReviewAlert(opts: {
  to:           string[]
  tenantName:   string
  platform:     string
  locationName: string
  rating:       number
  authorName:   string
  reviewBody:   string
  reviewUrl:    string
  isUrgent:     boolean
}) {
  const stars = "★".repeat(Math.round(opts.rating)) + "☆".repeat(5 - Math.round(opts.rating))
  const urgentBadge = opts.isUrgent
    ? `<span style="background:#ef4444;color:white;padding:2px 8px;border-radius:4px;font-size:12px;">URGENT</span>`
    : ""

  await sendEmail({
    to:      opts.to,
    subject: `${opts.isUrgent ? "🚨 " : ""}New ${opts.rating}★ review on ${opts.platform} — ${opts.tenantName}`,
    htmlBody: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2>${opts.tenantName} — New Review ${urgentBadge}</h2>
        <p><strong>Platform:</strong> ${opts.platform} &nbsp;|&nbsp; <strong>Location:</strong> ${opts.locationName}</p>
        <p><strong>Rating:</strong> ${stars} (${opts.rating}/5)</p>
        <p><strong>By:</strong> ${opts.authorName}</p>
        <blockquote style="border-left:4px solid #6366f1;padding:12px;background:#f8fafc;border-radius:4px;">
          ${opts.reviewBody}
        </blockquote>
        <a href="${opts.reviewUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#6366f1;color:white;border-radius:6px;text-decoration:none;">
          View & Respond
        </a>
      </div>
    `,
    textBody: `New ${opts.rating}★ review on ${opts.platform} by ${opts.authorName}:\n\n${opts.reviewBody}\n\nView: ${opts.reviewUrl}`,
  })
}

export async function sendDraftPendingApproval(opts: {
  to:          string[]
  tenantName:  string
  reviewBody:  string
  draftBody:   string
  approveUrl:  string
  rejectUrl:   string
}) {
  await sendEmail({
    to:      opts.to,
    subject: `Review response draft needs your approval — ${opts.tenantName}`,
    htmlBody: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2>Response Draft Ready for Approval</h2>
        <h3>Original Review</h3>
        <blockquote style="border-left:4px solid #94a3b8;padding:12px;background:#f8fafc;">
          ${opts.reviewBody}
        </blockquote>
        <h3>AI-Generated Response</h3>
        <blockquote style="border-left:4px solid #6366f1;padding:12px;background:#f0f0ff;">
          ${opts.draftBody}
        </blockquote>
        <div style="margin-top:20px;display:flex;gap:12px;">
          <a href="${opts.approveUrl}" style="padding:10px 24px;background:#22c55e;color:white;border-radius:6px;text-decoration:none;">
            ✓ Approve & Publish
          </a>
          <a href="${opts.rejectUrl}" style="padding:10px 24px;background:#ef4444;color:white;border-radius:6px;text-decoration:none;">
            ✗ Reject
          </a>
        </div>
      </div>
    `,
    textBody: `A response draft is pending your approval.\n\nOriginal Review:\n${opts.reviewBody}\n\nDraft Response:\n${opts.draftBody}\n\nApprove: ${opts.approveUrl}\nReject: ${opts.rejectUrl}`,
  })
}
