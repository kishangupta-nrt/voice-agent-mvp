import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const confirmUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify?token=${token}`;
  
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Verify your email - Voice Agent',
      html: `
        <h1>Welcome to Voice Agent!</h1>
        <p>Click the link below to verify your email:</p>
        <a href="${confirmUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Verify Email</a>
        <p>Or copy this link: ${confirmUrl}</p>
        <p>This link expires in 24 hours.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendWelcomeEmail(to: string): Promise<boolean> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Welcome to Voice Agent!',
      html: `
        <h1>Welcome aboard!</h1>
        <p>Your email has been verified. You can now use Voice Agent.</p>
        <p>Start chatting at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
}
