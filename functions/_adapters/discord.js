// Discord Webhook 适配器
// 文档：https://discord.com/developers/docs/resources/webhook#execute-webhook

import { sendHttp } from '../_lib/sender.js';

export const id = 'discord';
export const name = 'Discord Webhook';
export const description = '推送到 Discord 频道';
export const maxLength = 2000;
export const contentType = 'markdown';

export const fields = [
  { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...', required: true },
  { key: 'username', label: '用户名（可选）' },
];

export const defaultLevelMap = {};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const webhookUrl = cfg.webhookUrl || '';
  if (!webhookUrl) return { ok: false, status: 0, body: '', error: '缺少 Webhook URL' };

  const body = {
    content: message.title ? `**${message.title}**\n${message.body}` : message.body || '',
  };
  if (cfg.username) body.username = cfg.username;

  return sendHttp(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}