// Slack Incoming Webhook 适配器
// 文档：https://api.slack.com/messaging/webhooks

import { sendHttp } from '../_lib/sender.js';

export const id = 'slack';
export const name = 'Slack Webhook';
export const description = '推送到 Slack 频道（Incoming Webhook）';
export const maxLength = 4000;
export const contentType = 'markdown';

export const fields = [
  { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...', required: true },
  { key: 'channel', label: '频道覆盖（可选）', placeholder: '如 #general' },
  { key: 'username', label: '用户名（可选）' },
  { key: 'iconEmoji', label: '图标 Emoji（可选）', placeholder: ':bell:' },
];

export const defaultLevelMap = {};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const webhookUrl = cfg.webhookUrl || '';
  if (!webhookUrl) return { ok: false, status: 0, body: '', error: '缺少 Webhook URL' };

  const body = {
    text: message.title ? `*${message.title}*\n${message.body}` : message.body || '',
  };
  if (cfg.channel) body.channel = cfg.channel;
  if (cfg.username) body.username = cfg.username;
  if (cfg.iconEmoji) body.icon_emoji = cfg.iconEmoji;

  return sendHttp(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}