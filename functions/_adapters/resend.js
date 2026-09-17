// Resend 邮件适配器（免费版 3000 封/日）
// 文档：https://resend.com/docs/api-reference/emails/send-email

import { sendHttp } from '../_lib/sender.js';

export const id = 'resend';
export const name = '邮件（Resend）';
export const description = '通过 Resend API 发送邮件（免费档 3000 封/月）';
export const maxLength = 50000;
export const contentType = 'html';

export const fields = [
  { key: 'apiKey', label: 'API Key', placeholder: 're_xxxxxxxx', required: true },
  { key: 'from', label: '发件人', placeholder: 'HookHub <noreply@yourdomain.com>', required: true },
  { key: 'to', label: '收件人', placeholder: 'you@example.com', required: true },
];

export const defaultLevelMap = {};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const apiKey = cfg.apiKey || '';
  const from = cfg.from || '';
  const to = cfg.to || '';
  if (!apiKey || !from || !to) return { ok: false, status: 0, body: '', error: '缺少 API Key / 发件人 / 收件人' };

  const subject = message.title || 'HookHub 通知';
  const htmlBody =
    `<h2>${escapeHtml(message.title || '')}</h2><pre style="white-space:pre-wrap;font-family:ui-monospace,monospace">${escapeHtml(message.body || '')}</pre>`;

  const body = {
    from,
    to: String(to).split(',').map((s) => s.trim()).filter(Boolean),
    subject,
    html: htmlBody,
  };

  return sendHttp('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}