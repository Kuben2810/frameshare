import { Resend } from "resend"
import nodemailer from "nodemailer"

type EmailPayload = {
  to: string
  subject: string
  html: string
}

async function sendViaResend({ to, subject, html }: EmailPayload) {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  await resend.emails.send({
    from: process.env.SMTP_FROM ?? "noreply@frameshare.app",
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
    from: process.env.SMTP_FROM ?? "noreply@frameshare.app",
    to,
    subject,
    html,
  })
}

export async function sendEmail(payload: EmailPayload) {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(payload)
  }
  return sendViaSMTP(payload)
}
