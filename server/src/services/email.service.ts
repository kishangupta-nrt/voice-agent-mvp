import { Resend } from 'resend';
import { ENV } from '../config/env';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!resend && ENV.RESEND_API_KEY) {
    resend = new Resend(ENV.RESEND_API_KEY);
  }
  return resend;
}

export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.warn('Resend not configured, skipping verification email');
    return false;
  }

  const encodedToken = encodeURIComponent(token);
  const confirmUrl = `${ENV.FRONTEND_URL}/verify?token=${encodedToken}`;

  try {
    await client.emails.send({
      from: ENV.FROM_EMAIL,
      to,
      subject: 'Verify your email - Voice Agent',
      html: `
        <h1>Welcome to Voice Agent!</h1>
        <p>Click the link below to verify your email:</p>
        <a href="${confirmUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Verify Email</a>
        <p>This link expires in 24 hours.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function sendWelcomeEmail(to: string): Promise<boolean> {
  const client = getResend();
  if (!client) return false;

  try {
    await client.emails.send({
      from: ENV.FROM_EMAIL,
      to,
      subject: 'Welcome to Voice Agent!',
      html: `
        <h1>Welcome aboard!</h1>
        <p>Your email has been verified. You can now use Voice Agent.</p>
        <p>Start chatting at: ${ENV.FRONTEND_URL}</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error instanceof Error ? error.message : error);
    return false;
  }
}
