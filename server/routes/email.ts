import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

interface EmailRequestBody {
  to: string;
  subject: string;
  html: string;
}

const ALLOWED_RECIPIENTS = new Set([
  'admin@localhost',
  'dev@localhost',
]);

function getSMTPConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
}

function createTransporter() {
  const config = getSMTPConfig();

  if (!config.host || !config.auth.user || !config.auth.pass) {
    throw new Error('SMTP configuration is incomplete');
  }

  return nodemailer.createTransport(config);
}

export function generateRecapEmailHTML(
  title: string,
  summary: string,
  items: Array<{ id: string; type: string; message: string; details?: string }>,
  timestamp: string
): string {
  const typeColors: Record<string, string> = {
    info: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  };

  const itemsHTML = items
    .map(
      (item) => `
      <div style="margin-bottom: 12px; padding: 12px; background: #f8fafc; border-left: 3px solid ${typeColors[item.type] || '#3b82f6'}; border-radius: 4px;">
        <strong style="color: ${typeColors[item.type] || '#3b82f6'};">${item.message}</strong>
        ${item.details ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">${item.details}</p>` : ''}
      </div>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #1e293b; margin: 0 0 16px; font-size: 24px;">${title}</h1>
    <p style="color: #475569; margin: 0 0 20px; font-size: 16px;">${summary}</p>
    <div style="margin-bottom: 20px;">${itemsHTML}</div>
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">Generated at ${timestamp}</p>
  </div>
</body>
</html>
  `.trim();
}

export function createEmailRouter(): Router {
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const { to, subject, html } = req.body as EmailRequestBody;

      if (!to || !subject || !html) {
        res.status(400).json({ error: 'Missing required fields: to, subject, html' });
        return;
      }

      if (!ALLOWED_RECIPIENTS.has(to)) {
        res.status(403).json({ error: 'Recipient not allowed' });
        return;
      }

      const transporter = createTransporter();

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      const err = error as Error;
      console.error('Email send error:', err.message);
      res.status(500).json({ error: 'Failed to send email', details: err.message });
    }
  });

  router.post('/recap', async (req: Request, res: Response) => {
    try {
      const { to, title, summary, items } = req.body as {
        to: string;
        title: string;
        summary: string;
        items: Array<{ id: string; type: string; message: string; details?: string }>;
      };

      if (!to || !title || !summary || !items) {
        res.status(400).json({ error: 'Missing required fields: to, title, summary, items' });
        return;
      }

      if (!ALLOWED_RECIPIENTS.has(to)) {
        res.status(403).json({ error: 'Recipient not allowed' });
        return;
      }

      const html = generateRecapEmailHTML(title, summary, items, new Date().toISOString());

      const transporter = createTransporter();

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: title,
        html,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      const err = error as Error;
      console.error('Recap email send error:', err.message);
      res.status(500).json({ error: 'Failed to send recap email', details: err.message });
    }
  });

  return router;
}
