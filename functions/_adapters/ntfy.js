// ntfy 适配器（自托管/公共服务器）
// 文档：https://docs.ntfy.sh/publish/

import { sendHttp } from '../_lib/sender.js';

export const id = 'ntfy';
export const name = 'ntfy';
export const description = '轻量 pub/sub 通知，支持自托管';
export const maxLength = 4096;
export const contentType = 'markdown';

export const fields = [
  { key: 'server', label: '服务器地址', placeholder: 'https://ntfy.sh', default: 'https://ntfy.sh' },
  { key: 'topic', label: 'Topic', placeholder: '你的主题名', required: true },
  { key: 'token', label: 'Token（可选）', placeholder: '自托管时的 auth 令牌' },
];

export const defaultLevelMap = {
  info: 'default',
  success: 'default',
  warning: 'warning',
  error: 'urgent',
};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const server = (cfg.server || 'https://ntfy.sh').replace(/\/+$/, '');
  const topic = cfg.topic || '';
  if (!topic) return { ok: false, status: 0, body: '', error: '缺少 Topic' };

  const levelMap = { ...defaultLevelMap, ...(channel.levelMap || {}) };
  const headers = {
    Title: message.title || '',
    Priority: levelMap[message.level] || 'default',
  };
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
  if (message.url) headers.Click = message.url;
  const tags = message.tags;
  if (Array.isArray(tags) && tags.length) headers.Tags = tags.join(',');

  return sendHttp(`${server}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers,
    body: message.body || '',
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}