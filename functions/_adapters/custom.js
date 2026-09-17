// 通用自定义 Webhook 适配器（万能兜底）
// 支持任意 URL / Method / Headers / Body 模板。userBodyTemplate 可用模板语法。
// 注意：任何自定义 url 都会先经过 SSRF 校验（仅允许 http/https、拒绝内网段）。

import { sendHttp } from '../_lib/sender.js';
import { renderTemplate } from '../_lib/template.js';

export const id = 'custom';
export const name = '通用自定义 Webhook';
export const description = '万能兜底：任意 URL / Method / Headers / Body 模板的 HTTP 调用';
export const maxLength = 50000;
export const contentType = 'json';

export const fields = [
  { key: 'url', label: '目标 URL', placeholder: 'https://example.com/api/notify', required: true },
  { key: 'method', label: 'HTTP 方法', type: 'select', options: ['POST', 'GET', 'PUT', 'PATCH'], default: 'POST' },
  { key: 'headersJson', label: '额外请求头（JSON 对象）', placeholder: '{"X-Token": "xxx"}', type: 'textarea' },
  { key: 'bodyTemplate', label: 'Body 模板', type: 'textarea', placeholder: '{"title":"{{title}}","content":"{{body}}","level":"{{level}}"}' },
  { key: 'contentType', label: 'Content-Type', placeholder: 'application/json（可选，填了会覆盖 headers 里的同名项）' },
];

export const defaultLevelMap = {};

export async function send(channel, message, opts = {}) {
  const cfg = channel.config || {};
  const url = cfg.url || '';
  if (!url) return { ok: false, status: 0, body: '', error: '缺少目标 URL' };

  let headers = {};
  if (cfg.headersJson) {
    try {
      headers = { ...JSON.parse(cfg.headersJson) };
    } catch {
      return { ok: false, status: 0, body: '', error: '请求头不是合法 JSON' };
    }
  }
  const method = (cfg.method || 'POST').toUpperCase();
  let body = null;
  if (cfg.bodyTemplate) {
    const rendered = renderTemplate(cfg.bodyTemplate, message);
    const ct = cfg.contentType || headers['Content-Type'] || headers['content-type'];
    if (ct && ct.includes('json')) {
      try {
        body = JSON.stringify(JSON.parse(rendered));
      } catch {
        return { ok: false, status: 0, body: '', error: 'Body 模板渲染后不是合法 JSON，请检查占位符' };
      }
    } else {
      body = rendered;
    }
  } else if (['POST', 'PUT', 'PATCH'].includes(method)) {
    // 无模板时回退：发标准 JSON（title/body/…）
    body = JSON.stringify({
      title: message.title || '',
      body: message.body || '',
      level: message.level || 'info',
      url: message.url || '',
      tags: message.tags || [],
      data: message.data || {},
    });
  }

  if (cfg.contentType) headers['Content-Type'] = cfg.contentType;
  else if (body && !headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json';

  return sendHttp(url, {
    method,
    headers,
    body,
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
    allowLocalhost: opts.allowLocalhost,
  });
}