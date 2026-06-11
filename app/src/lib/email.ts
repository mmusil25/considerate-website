import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

/**
 * Transactional email via SES. The verified identity for the site domain lives
 * in SES_REGION (us-east-1 — it's the WorkMail-managed identity, see
 * terraform/ses.tf), which is NOT necessarily the app's own AWS_REGION.
 *
 * Senders should treat this as best-effort: a failed notification must never
 * fail the user-facing action that triggered it (the submission is already in
 * the DB). Callers decide whether to await or fire-and-forget.
 */
const sesRegion = process.env.SES_REGION || process.env.AWS_REGION

let client: SESv2Client | null = null
function ses(): SESv2Client {
  if (!client) client = new SESv2Client({ region: sesRegion })
  return client
}

export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
  replyTo?: string
}): Promise<void> {
  const from = process.env.EMAIL_FROM
  if (!from) {
    // Local dev has no SES config — log instead of sending so the flow is visible.
    console.log(`[email] EMAIL_FROM not set; would send to ${opts.to}: ${opts.subject}\n${opts.text}`)
    return
  }
  await ses().send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [opts.to] },
      ReplyToAddresses: opts.replyTo ? [opts.replyTo] : undefined,
      Content: {
        Simple: {
          Subject: { Data: opts.subject },
          Body: { Text: { Data: opts.text } },
        },
      },
    }),
  )
}
