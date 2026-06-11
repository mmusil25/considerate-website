'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { sendEmail } from '@/lib/email'

const MAX_PER_IP_PER_HOUR = 5

/**
 * Handles the /contact form POST. Validation failures and rate limiting
 * redirect back with a query flag the page renders as a banner; the honeypot
 * pretends success so bots get no signal. The submission is stored first —
 * the email notification is best-effort on top.
 */
export async function submitContact(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()
  // Honeypot: real users never see or fill this field (visually hidden,
  // aria-hidden, tabIndex -1). Anything in it means a bot — claim success.
  const honeypot = String(formData.get('company') ?? '')

  if (honeypot) redirect('/contact?sent=1')

  const valid =
    name.length > 0 && name.length <= 200 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320 &&
    subject.length > 0 && subject.length <= 300 &&
    message.length > 0 && message.length <= 5000
  if (!valid) redirect('/contact?error=invalid')

  const h = await headers()
  // First hop of X-Forwarded-For is the client (set by CloudFront/ALB).
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const userAgent = (h.get('user-agent') ?? '').slice(0, 500)

  const payload = await getPayload({ config })

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent = await payload.count({
    collection: 'contact-submissions',
    where: { and: [{ ip: { equals: ip } }, { createdAt: { greater_than: hourAgo } }] },
  })
  if (recent.totalDocs >= MAX_PER_IP_PER_HOUR) redirect('/contact?error=rate')

  await payload.create({
    collection: 'contact-submissions',
    data: { name, email, subject, message, ip, userAgent, status: 'new' },
  })

  const notifyTo = process.env.CONTACT_NOTIFY_TO
  if (notifyTo) {
    try {
      await sendEmail({
        to: notifyTo,
        replyTo: email,
        subject: `[consideratesystems.com] ${subject}`,
        text: `New contact form submission:\n\nFrom: ${name} <${email}>\nSubject: ${subject}\n\n${message}\n\n—\nReply to this email to respond directly. Full record in the admin under Contact Submissions.`,
      })
    } catch (err) {
      // Submission is already saved; never fail the user on a notification.
      console.error('[contact] notification email failed:', err)
    }
  }

  redirect('/contact?sent=1')
}
