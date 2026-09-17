// 飞书自定义机器人适配器（含签名校验）
// 文档：https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
// 签名算法（注意与钉钉不同）：
//   timestamp 单位【秒】；key = `${timestamp}\n${secret}`；对【空字符串】做 HMAC-SHA256；Base64
//   timestamp 和 sign 放在 JSON body 中（不是 URL 参数）

import { sendHttp } from '../_lib/sender.js';
import { hmacSha256 } from '../_lib/crypto.js';

export const id = 'feishu';
export const name = '飞书机器人';
export const description = '推送到飞书群（自定义机器人，支持签名校验）';
export const maxLength = 20000;
export const contentType = 'markdown';

export const fields = [
  { key: 'webhook', label: 'Webhook 地址', placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx', required: true },
  { key: 'secret', label: '签名密钥（可选）', placeholder: '开启签名校验后获取' },
];

export const defaultLevelMap = {};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const webhook = cfg.webhook || '';
  if (!webhook) return { ok: false, status: 0, body: '', error: '缺少 Webhook 地址' };

  const payload = {
    msg_type: 'text',
    content: { text: message.title ? `【${message.title}】\n${message.body}` : message.body || '' },
  };

  if (cfg.secret) {
    const timestamp = Math.floor(Date.now() / 1000); // 秒
    const stringToSign = `${timestamp}\n${cfg.secret}`;
    // key = 拼接串，对空串做 HMAC
    const sign = await hmacSha256(stringToSign, '', 'base64');
    payload.timestamp = String(timestamp);
    payload.sign = sign;
  }

  return sendHttp(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}