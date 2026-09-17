// Gotify 适配器（自托管推送服务）
// 文档：https://gotify.net/docs/pushmsg

import { sendHttp } from '../_lib/sender.js';

export const id = 'gotify';
export const name = 'Gotify';
export const description = '自托管推送服务（类似 ntfy，可自建）';
export const maxLength = 4000;
export const contentType = 'markdown';

export const fields = [
  { key: 'server', label: '服务器地址', placeholder: 'https://gotify.example.com', required: true },
  { key: 'appToken', label: 'App Token', placeholder: 'Gotify 中创建的 App Token', required: true },
  { key: 'priority', label: '默认优先级', type: 'select', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], default: '5' },
];

export const defaultLevelMap = {
  info: 3,
  success: 3,
  warning: 7,
  error: 10,
};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const server = (cfg.server || '').replace(/\/+$/, '');
  const appToken = cfg.appToken || '';
  if (!server || !appToken) return { ok: false, status: 0, body: '', error: '缺少服务器地址或 App Token' };

  const levelMap = { ...defaultLevelMap, ...(channel.levelMap || {}) };
  const body = {
    title: message.title || '',
    message: message.body || '',
    priority: levelMap[message.level] ?? Number(cfg.priority || 5),
  };
  if (message.url) body.extras = { 'client::notification': { click: { url: message.url } } };

  return sendHttp(`${server}/message?token=${encodeURIComponent(appToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}