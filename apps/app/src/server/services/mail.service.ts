import { config } from '../config/env.config.js';
import { transporter } from '../config/mail.config.js';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendVerificationCodeEmail(
  toEmail: string,
  username: string,
  code: string
): Promise<void> {
  const safeUsername = escapeHtml(username);
  const safeCode = escapeHtml(code);
  const subject = `${code} is your BoardStack verification code`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #111827; }
    .card { background: #ffffff; max-width: 480px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-sizing: border-box; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #111827; }
    .subtitle { font-size: 14px; color: #4b5563; line-height: 1.5; margin: 0 0 24px; }
    .code-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827; font-family: monospace; margin: 24px 0; }
    .footer { font-size: 12px; color: #9ca3af; line-height: 1.4; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1 class="title">Hello, ${safeUsername}</h1>
    <p class="subtitle">Use the following verification code to complete your BoardStack account setup. This code will expire in 15 minutes.</p>
    <div class="code-box">${safeCode}</div>
    <p class="subtitle">If you did not request this verification code, you can safely ignore this message.</p>
    <div class="footer">BoardStack &copy; ${new Date().getFullYear()}</div>
  </div>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: config.smtp.from,
    html,
    subject,
    text: `Hello ${username}, your verification code is: ${code}. It expires in 15 minutes.`,
    to: toEmail,
  });
}

async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<void> {
  const safeResetUrl = escapeHtml(resetUrl);
  const subject = 'Reset your BoardStack password';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #111827; }
    .card { background: #ffffff; max-width: 480px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-sizing: border-box; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #111827; }
    .subtitle { font-size: 14px; color: #4b5563; line-height: 1.5; margin: 0 0 24px; }
    .btn { display: inline-block; background-color: #000000; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 14px; text-align: center; }
    .footer { font-size: 12px; color: #9ca3af; line-height: 1.4; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1 class="title">Password Reset Request</h1>
    <p class="subtitle">We received a request to reset your password. Click the button below to choose a new password:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${safeResetUrl}" class="btn">Reset Password</a>
    </div>
    <p class="subtitle">This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
    <div class="footer">BoardStack &copy; ${new Date().getFullYear()}</div>
  </div>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: config.smtp.from,
    html,
    subject,
    text: `We received a request to reset your password. Use the following link: ${resetUrl}. It expires in 1 hour.`,
    to: toEmail,
  });
}

async function sendEmailChangeCodeEmail(
  toEmail: string,
  code: string
): Promise<void> {
  const safeCode = escapeHtml(code);
  const subject = `${code} is your email change code for BoardStack`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px; color: #111827; }
    .card { background: #ffffff; max-width: 480px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-sizing: border-box; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #111827; }
    .subtitle { font-size: 14px; color: #4b5563; line-height: 1.5; margin: 0 0 24px; }
    .code-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827; font-family: monospace; margin: 24px 0; }
    .footer { font-size: 12px; color: #9ca3af; line-height: 1.4; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1 class="title">Email Change Request</h1>
    <p class="subtitle">Use the following verification code to authorize changing your email address. This code expires in 15 minutes.</p>
    <div class="code-box">${safeCode}</div>
    <p class="subtitle">If you did not request this change, please secure your account immediately.</p>
    <div class="footer">BoardStack &copy; ${new Date().getFullYear()}</div>
  </div>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: config.smtp.from,
    html,
    subject,
    text: `Your email change code for BoardStack is: ${code}. It expires in 15 minutes.`,
    to: toEmail,
  });
}

export {
  sendEmailChangeCodeEmail,
  sendPasswordResetEmail,
  sendVerificationCodeEmail
};
