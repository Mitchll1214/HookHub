// Bark 适配器（iOS 推送）
// 文档：https://github.com/Finb/Bark

import { sendHttp } from '../_lib/sender.js';

export const id = 'bark';
export const name = 'Bark（iOS 推送）';
export const description = '推送到 iPhone 的通知，推荐配合 Bark 官方 App 使用';
export const maxLength = 4096;
export const contentType = 'markdown';

export const fields = [
  { key: 'deviceKey', label: '设备 Key', placeholder: 'Bark App 首页显示的 8 位 Key', required: true },
  { key: 'server', label: '服务器地址', placeholder: 'https://api.day.app', default: 'https://api.day.app' },
  { key: 'group', label: '分组 Group（可选）', placeholder: '默认分组' },
  { key: 'icon', label: '图标 URL（可选）' },
  { key: 'sound', label: '提示音（可选）', placeholder: '如 birdsong' },
];

// 中断级别（iOS 14+）
export const defaultLevelMap = {
  info: 'passive',
  success: 'passive',
  warning: 'timeSensitive',
  error: 'critical',
};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const key = cfg.deviceKey || '';
  if (!key) return { ok: false, status: 0, body: '', error: '缺少设备 Key' };
  const server = (cfg.server || 'https://api.day.app').replace(/\/+$/, '');

  const levelMap = { ...defaultLevelMap, ...(channel.levelMap || {}) };
  const body = {
    title: message.title || '',
    body: message.body || '',
    level: levelMap[message.level] || message.level || 'passive',
  };
  if (cfg.group) body.group = cfg.group;
  if (cfg.icon) body.icon = cfg.icon;
  if (cfg.sound) body.sound = cfg.sound;
  if (message.url) body.url = message.url;

  return sendHttp(`${server}/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}