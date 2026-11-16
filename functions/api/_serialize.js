// /api/* 的响应序列化：集中在一处，避免各端点复制粘贴后字段漂移。
//
// 文件名以 _ 开头 —— Pages Functions 不把它当路由（test/functions.test.js 也跳过 _ 前缀）。

import { maskSecret } from '../_lib/core.js';
import { registry } from '../_adapters/index.js';

// 判定「密钥字段」：命中则脱敏
const SECRET_KEY_RE = /key|token|secret|password|sendkey|api/i;

/**
 * 渠道序列化。
 * @param {object} ch 渠道配置对象
 * @param {{full?: boolean}} opts full=true 返回含密钥的完整配置（仅管理端按 id 读取时用）
 */
export function serializeChannel(ch, { full = false } = {}) {
  const out = {
    id: ch.id,
    name: ch.name,
    type: ch.type,
    enabled: ch.enabled !== false,
    createdAt: ch.createdAt,
    updatedAt: ch.updatedAt,
    levelMap: ch.levelMap || {},
    // 列表接口也需要它：前端渠道表单回填模板覆盖
    template: ch.template || null,
  };
  if (full) {
    out.config = ch.config || {};
    out.mapping = ch.mapping || {};
  } else {
    const cfg = ch.config || {};
    const meta = registry[ch.type];
    const masked = {};
    if (meta) {
      for (const f of meta.fields) {
        const v = cfg[f.key];
        if (v != null && v !== '') {
          masked[f.key] = SECRET_KEY_RE.test(f.key) ? maskSecret(String(v)) : v;
        }
      }
    }
    out.configMasked = masked;
  }
  return out;
}

export function serializeRoute(r) {
  return {
    id: r.id,
    name: r.name || '未命名路由',
    enabled: r.enabled !== false,
    when: r.when || {},
    targets: r.targets || [],
    parallel: r.parallel !== false,
    failover: r.failover || [],
    priority: r.priority || 0,
    // 列表按 priority 降序、同优先级按创建时间升序排列，缺了它就排不稳
    createdAt: r.createdAt || null,
    updatedAt: r.updatedAt || null,
  };
}

export function serializeToken(t) {
  return {
    token: t.token,
    name: t.name || '',
    enabled: t.enabled !== false,
    allowedChannels: (t.allowedChannels || []).map((c) => (c.startsWith('channel:') ? c.slice(8) : c)),
    createdAt: t.createdAt,
    expiresAt: t.expiresAt || null,
  };
}

export function serializeGroup(g) {
  return {
    name: g.name,
    channels: (g.channels || []).map((c) => (c.startsWith('channel:') ? c.slice(8) : c)),
    enabled: g.enabled !== false,
  };
}

/** 按创建时间升序（ISO 字符串比较，不能用减法） */
export function byCreatedAtAsc(a, b) {
  return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}