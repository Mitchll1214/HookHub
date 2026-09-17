// 企业微信群机器人适配器
// 文档：https://developer.work.weixin.qq.com/document/path/91770

import { sendHttp } from '../_lib/sender.js';

export const id = 'wecom';
export const name = '企业微信机器人';
export const description = '推送到企业微信群（群机器人 Webhook）';
export const maxLength = 2048;
export const contentType = 'markdown';

export const fields = [
  { key: 'key', label: 'Webhook Key', placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key= 后面的部分', required: true },
  { key: 'msgtype', label: '消息类型', type: 'select', options: ['markdown', 'text'], default: 'markdown' },
];

// 企业微信 markdown 颜色：info 绿 / comment 橙 / warning 红
export const defaultLevelMap = {
  info: 'info',
  success: 'info',
  warning: 'comment',
  error: 'warning',
};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const key = cfg.key || '';
  if (!key) return { ok: false, status: 0, body: '', error: '缺少 Webhook Key' };
  const msgtype = cfg.msgtype || 'markdown';

  let body;
  if (msgtype === 'text') {
    body = { msgtype: 'text', text: { content: message.title ? `${message.title}\n${message.body}` : message.body } };
  } else {
    const color = (channel.levelMap && channel.levelMap[message.level]) || 'info';
    const text = message.title ? `**${message.title}**\n${message.body}` : message.body;
    body = { msgtype: 'markdown', markdown: { content: `<font color="${color}">[${message.level || 'info'}]</font> ${text}` } };
  }

  return sendHttp(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}