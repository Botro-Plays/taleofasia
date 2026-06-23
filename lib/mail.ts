import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { webDB } from '@/lib/db';

interface EmailConfig {
  provider: 'smtp' | 'resend' | 'zoho';
  from: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  resendApiKey: string;
  zohoUser: string;
  zohoPass: string;
  zohoHost: string;
  zohoPort: number;
}

async function loadEmailConfig(): Promise<EmailConfig> {
  const res = await webDB.query(
    `SELECT ConfigKey, ConfigValue FROM WebsiteConfigs WHERE ConfigKey LIKE 'email_%' OR ConfigKey LIKE 'smtp_%' OR ConfigKey LIKE 'resend_%' OR ConfigKey LIKE 'zoho_%'`
  );
  const rows = res.recordset || [];
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[String(row.ConfigKey || '').toLowerCase()] = String(row.ConfigValue || '');
  }

  // Support both legacy (email_smtp_*) and new canonical (smtp_*) keys
  return {
    provider: (map.email_provider || 'smtp') as EmailConfig['provider'],
    from: map.email_from || map.email_smtp_username || 'noreply@taleofasia.com',
    fromName: map.email_from_name || 'Tale of Asia',
    smtpHost: map.smtp_host || map.email_smtp_host || 'taleofasia.com',
    smtpPort: parseInt(map.smtp_port || map.email_smtp_port || '465', 10),
    smtpSecure: (map.smtp_secure || map.email_smtp_secure || 'true').toLowerCase() === 'true',
    smtpUser: map.smtp_user || map.email_smtp_username || '',
    smtpPass: map.smtp_pass || map.email_smtp_password || '',
    resendApiKey: map.resend_api_key || '',
    zohoUser: map.zoho_user || '',
    zohoPass: map.zoho_pass || '',
    zohoHost: map.zoho_host || 'smtp.zoho.com',
    zohoPort: parseInt(map.zoho_port || '465', 10),
  };
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const config = await loadEmailConfig();
  const from = `"${config.fromName}" <${config.from}>`;

  if (config.provider === 'resend') {
    if (!config.resendApiKey) {
      throw new Error('Resend API key is not configured. Set it in WebsiteConfigs (resend_api_key).');
    }
    const resend = new Resend(config.resendApiKey);
    const result = await resend.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      text: options.text || '',
      html: options.html,
    });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
    return;
  }

  // SMTP or Zoho - both use Nodemailer
  const isZoho = config.provider === 'zoho';
  const host = isZoho ? config.zohoHost : config.smtpHost;
  const port = isZoho ? config.zohoPort : config.smtpPort;
  const secure = isZoho ? true : config.smtpSecure;
  const user = isZoho ? config.zohoUser : config.smtpUser;
  const pass = isZoho ? config.zohoPass : config.smtpPass;

  if (!user) {
    throw new Error(`${config.provider} username is not configured. Set it in WebsiteConfigs.`);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://taleofasia.com';
const logoUrl = `${baseUrl}/images/toa-logo.png`;

function emailTemplate(title: string, bodyHtml: string, footerNote: string): string {
  return `
    <div style="background: #08080C; padding: 24px 16px; font-family: 'Segoe UI', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(145deg, #141219, #0C0A10); border: 1px solid rgba(184,155,94,0.22); overflow: hidden;">

        <div style="background: linear-gradient(135deg, #141219 0%, #0A0810 100%); padding: 40px 32px 32px; text-align: center; border-bottom: 1px solid rgba(184,155,94,0.25);">
          <img src="${logoUrl}" alt="Tale of Asia" style="max-width: 100px; height: auto; display: block; margin: 0 auto 20px;" />
          <div style="width: 40px; height: 1px; background: rgba(184,155,94,0.4); margin: 0 auto 16px;"></div>
          <h1 style="color: #D4B97A; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; margin: 0;">${title}</h1>
          <div style="width: 40px; height: 1px; background: rgba(184,155,94,0.4); margin: 16px auto 0;"></div>
        </div>

        <div style="padding: 36px 32px; color: #C8C2B6; font-size: 15px; line-height: 1.75;">
          ${bodyHtml}
        </div>

        <div style="padding: 20px 32px; background: rgba(8,8,12,0.8); border-top: 1px solid rgba(184,155,94,0.1); text-align: center;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #9B95A9;">${footerNote}</p>
          <p style="margin: 0; font-size: 12px; color: #9B95A9;">Tale of Asia &mdash; <a href="${baseUrl}" style="color: #B89B5E; text-decoration: none;">${baseUrl.replace(/^https?:\/\//, '')}</a></p>
        </div>

      </div>
    </div>
  `;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  await sendEmail({
    to,
    subject: 'Password Reset Request - Tale of Asia',
    html: emailTemplate(
      'Recover Your Account',
      `
        <p style="margin: 0 0 16px;">Greetings, Hero!</p>
        <p style="margin: 0 0 24px;">We received a request to reset your password. Click the link below to set a new one:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 13px 36px; background: linear-gradient(135deg, #B89B5E 0%, #8B7340 100%); color: #08080C; text-decoration: none; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 2.5px; font-family: Georgia, serif;">Reset Password</a>
        </div>
        <p style="margin: 0 0 8px; font-size: 13px; color: #9B95A9;">Or copy this link into your browser:</p>
        <p style="margin: 0; word-break: break-all; font-size: 12px; color: #B89B5E;">${resetUrl}</p>
      `,
      'This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.'
    ),
    text: `Tale of Asia - Password Reset\n\nClick the link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string
): Promise<void> {
  await sendEmail({
    to,
    subject: 'Verify Your Email - Tale of Asia',
    html: emailTemplate(
      'Verify Your Email',
      `
        <p style="margin: 0 0 16px;">Welcome to the realm!</p>
        <p style="margin: 0 0 24px;">Before you embark on your journey, please verify your email address by clicking the link below:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 13px 36px; background: linear-gradient(135deg, #B89B5E 0%, #8B7340 100%); color: #08080C; text-decoration: none; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 2.5px; font-family: Georgia, serif;">Verify Email</a>
        </div>
        <p style="margin: 0 0 8px; font-size: 13px; color: #9B95A9;">Or copy this link into your browser:</p>
        <p style="margin: 0; word-break: break-all; font-size: 12px; color: #B89B5E;">${verifyUrl}</p>
      `,
      'This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.'
    ),
    text: `Tale of Asia - Email Verification\n\nClick the link to verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
}
