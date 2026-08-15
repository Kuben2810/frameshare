import { Resend } from "resend"
import nodemailer from "nodemailer"
import { getBaseUrl } from "@/lib/utils"

export type EmailPayload = {
  to: string
  subject: string
  html: string
}

async function sendViaResend({ to, subject, html }: EmailPayload) {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  await resend.emails.send({
    from: process.env.SMTP_FROM ?? "Frameshare <noreply@frameshare.app>",
    to,
    subject,
    html,
  })
}

async function sendViaSMTP({ to, subject, html }: EmailPayload) {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "Frameshare <noreply@frameshare.app>",
    to,
    subject,
    html,
  })
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend(payload)
      return true
    }
    if (process.env.SMTP_HOST) {
      await sendViaSMTP(payload)
      return true
    }
    console.log(`\n[EMAIL SIMULATION] To: ${payload.to}\nSubject: ${payload.subject}\n`)
    return true
  } catch (err) {
    console.error("[EMAIL ERROR] Failed to send email:", err)
    return false
  }
}

export async function sendSelectionNotificationEmail({
  photographerEmail,
  photographerName,
  galleryName,
  galleryId,
  slug,
  photoCount,
}: {
  photographerEmail: string
  photographerName: string
  galleryName: string
  galleryId: string
  slug: string
  photoCount: number
}) {
  const baseUrl = getBaseUrl()
  const dashboardUrl = `${baseUrl}/dashboard/galleries/${galleryId}`
  const clientGalleryUrl = `${baseUrl}/g/${slug}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #f2f3f5; margin: 0; padding: 32px 16px; }
    .card { max-width: 560px; margin: 0 auto; background-color: #16181a; border: 1px solid #282a2e; border-radius: 16px; padding: 36px 32px; }
    .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #00d26a; font-weight: 700; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0; }
    p { font-size: 14px; line-height: 1.6; color: #9da3ae; margin: 0 0 20px 0; }
    .highlight-box { background-color: #1f2226; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #00d26a; }
    .stat-number { font-size: 28px; font-weight: 800; color: #ffffff; font-family: sans-serif; }
    .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #9da3ae; margin-top: 2px; }
    .btn { display: inline-block; background-color: #ffffff; color: #000000; font-weight: 600; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .footer { text-align: center; margin-top: 28px; font-size: 11px; color: #525866; }
    .footer a { color: #828a99; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Frameshare Proofing Alert</div>
    <h1>Client Submitted Proofs</h1>
    <p>Hi ${photographerName || "Photographer"},</p>
    <p>Your client has completed their review and submitted their selected photos for <strong>${galleryName}</strong>.</p>
    
    <div class="highlight-box">
      <div class="stat-number">${photoCount}</div>
      <div class="stat-label">Photos Selected by Client</div>
    </div>

    <p>You can view the full selection list and copy all Lightroom filenames with 1-click directly in your collection hub:</p>

    <a href="${dashboardUrl}" class="btn">View Proofs in Studio</a>

    <p style="margin-top: 28px; font-size: 12px; color: #717784;">
      Client Gallery Link: <a href="${clientGalleryUrl}" style="color: #00d26a;">${clientGalleryUrl}</a>
    </p>
  </div>
  <div class="footer">
    Sent by <a href="${baseUrl}">Frameshare Studio</a> — Professional gallery delivery for photographers.
  </div>
</body>
</html>
`

  return sendEmail({
    to: photographerEmail,
    subject: `✨ New Client Proofs Submitted: ${photoCount} photos (${galleryName})`,
    html,
  })
}

