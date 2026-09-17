// Server酱（方糖）适配器
// 文档：https://sct.ftqq.com/

import { sendHttp } from '../_lib/sender.js';

export const id = 'serverchan';
export const name = 'Server酱（方糖）';
export const description = '通过微信接收通知（Server酱 Turbo）';
export const maxLength = 32768;
export const contentType = 'markdown';

export const fields = [
  { key: 'sendkey', label: 'SendKey', placeholder: 'sctpxxxxxxxxxx', required: true },
];

export const defaultLevelMap = {};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const key = cfg.sendkey || '';
  if (!key) return { ok: false, status: 0, body: '', error: '缺少 SendKey' };

  const form = new URLSearchParams();
  form.set('title', message.title || '');
  form.set('desp', message.body || '');
  if (message.url) form.set('url', message.url);

  return sendHttp(`https://sctapi.ftqq.com/${encodeURIComponent(key)}.send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}