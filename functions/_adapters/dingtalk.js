// 钉钉自定义机器人适配器（含加签安全设置）
// 文档：https://open.dingtalk.com/document/robots/custom-robot-access
// 加签算法：sign = URLEncode(Base64(HmacSHA256(timestamp + "\n" + secret, secret)))
//           timestamp 为毫秒，与请求时间误差不得超过 1 小时

import { sendHttp } from '../_lib/sender.js';
import { hmacSha256 } from '../_lib/crypto.js';

export const id = 'dingtalk';
export const name = '钉钉机器人';
export const description = '推送到钉钉群（自定义机器人，支持加签）';
export const maxLength = 20000;
export const contentType = 'markdown';

export const fields = [
  { key: 'accessToken', label: 'Access Token', placeholder: 'Webhook 地址 ?access_token= 后面的部分', required: true },
  { key: 'secret', label: '加签密钥（可选）', placeholder: '安全设置 → 加签 一栏的 SEC 开头字符串' },
  { key: 'requestTitle', label: 'markdown 标题', placeholder: '默认使用消息 title' },
  { key: 'atMobiles', label: '@ 手机号（逗号分隔，可选）', placeholder: '13800000000,13900000000' },
  { key: 'isAtAll', label: '@ 所有人', type: 'select', options: ['false', 'true'], default: 'false' },
];

export const defaultLevelMap = {};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const accessToken = cfg.accessToken || '';
  if (!accessToken) return { ok: false, status: 0, body: '', error: '缺少 Access Token' };

  const payload = {
    msgtype: 'markdown',
    markdown: {
      title: cfg.requestTitle || message.title || 'HookHub 通知',
      text: message.title ? `### ${message.title}\n${message.body}` : message.body || '',
    },
  };
  const at = {};
  if (cfg.atMobiles) at.atMobiles = String(cfg.atMobiles).split(',').map((s) => s.trim()).filter(Boolean);
  if (cfg.isAtAll === 'true') at.isAtAll = true;
  if (Object.keys(at).length) payload.at = at;

  let url = `https://oapi.dingtalk.com/robot/send?access_token=${encodeURIComponent(accessToken)}`;
  if (cfg.secret) {
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${cfg.secret}`;
    const sig = await hmacSha256(cfg.secret, stringToSign, 'base64');
    const sign = encodeURIComponent(sig);
    url += `&timestamp=${timestamp}&sign=${sign}`;
  }

  return sendHttp(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}