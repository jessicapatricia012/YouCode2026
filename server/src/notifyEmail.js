import nodemailer from 'nodemailer';

/**
 * Email the organizer when a listing is removed by an administrator.
 * If SMTP is not configured, logs a clear message and returns without throwing.
 */
export async function notifyOrganizerEventRemoved({
  to,
  orgName,
  eventTitle,
}) {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM;

  const subject = `ConnectBC: your event listing was removed`;
  const text = `Hello${orgName ? ` from ${orgName}` : ''},

Your event "${eventTitle}" was removed from the public ConnectBC map by a site administrator because it did not meet our guidelines.

If you believe this was a mistake, reply to this email or contact support using the address you use for your organizer account.

— ConnectBC
`;

  if (!host || !from) {
    console.warn(
      '[notify] SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM). Organizer removal email not sent.',
      { to, eventTitle }
    );
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });

  return { sent: true };
}
