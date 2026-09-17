// Telegram Bot 适配器
// 文档：https://core.telegram.org/bots/api#sendmessage

import { sendHttp } from '../_lib/sender.js';

export const id = 'telegram';
export const name = 'Telegram Bot';
export const description = '通过 Telegram Bot 推送到用户/群组';
export const maxLength = 4096;
export const contentType = 'markdown';

export const fields = [
  { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...', required: true },
  { key: 'chatId', label: 'Chat ID', placeholder: '用户 ID 或群组 ID（负数）', required: true },
  { key: 'parseMode', label: '解析模式', type: 'select', options: ['', 'Markdown', 'HTML'], default: 'Markdown' },
];

export const defaultLevelMap = {};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const botToken = cfg.botToken || '';
  const chatId = cfg.chatId || '';
  if (!botToken || !chatId) return { ok: false, status: 0, body: '', error: '缺少 Bot Token 或 Chat ID' };

  const body = {
    chat_id: chatId,
    text: message.title ? `*${message.title}*\n${message.body}` : message.body || '',
  };
  if (cfg.parseMode) body.parse_mode = cfg.parseMode;
  if (message.url) body.link_preview_options = { url: message.url, show_above_text: true };

  return sendHttp(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}