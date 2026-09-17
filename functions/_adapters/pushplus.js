// PushPlus 适配器（微信/邮件等推送）
// 文档：https://www.pushplus.plus/doc/

import { sendHttp } from '../_lib/sender.js';

export const id = 'pushplus';
export const name = 'PushPlus';
export const description = '通过微信公众号接收通知，支持多种渠道';
export const maxLength = 5000;
export const contentType = 'html';

export const fields = [
  { key: 'token', label: 'Token', placeholder: 'PushPlus 官网获取', required: true },
  { key: 'template', label: '内容格式', type: 'select', options: ['html', 'markdown', 'txt'], default: 'html' },
  { key: 'topic', label: '群组编码（可选）', placeholder: '一对多推送时填写' },
];

export const defaultLevelMap = {};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const token = cfg.token || '';
  if (!token) return { ok: false, status: 0, body: '', error: '缺少 Token' };

  const body = {
    token,
    title: message.title || '',
    content: message.body || '',
    template: cfg.template || 'html',
  };
  if (cfg.topic) body.topic = cfg.topic;

  return sendHttp('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}