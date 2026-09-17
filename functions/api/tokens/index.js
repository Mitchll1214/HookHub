// /api/tokens —— 令牌管理：列表 + 生成

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';
import { KV_KEYS, randomToken } from '../../_lib/core.js';

function serializeToken(t) {
  return {
    token: t.token,
    name: t.name || '',
    enabled: t.enabled !== false,
    allowedChannels: (t.allowedChannels || []).map((c) => (c.startsWith('channel:') ? c.slice(8) : c)),
    createdAt: t.createdAt,
    expiresAt: t.expiresAt || null,
  };
}

// GET 列表 + POST 生成
export const onRequest = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const method = context.request.method;

    if (method === 'GET') {
      const keys = await store.listKeys('token:');
      const tokens = [];
      for (const k of keys) {
        const t = await store.get(k);
        if (t) tokens.push(serializeToken(t));
      }
      // 保证第一次访问能看到一个默认令牌示例？不：默认空，由用户生成
      return json({ ok: true, tokens }, 200, cors);
    }

    if (method === 'POST') {
      const body = await context.request.json().catch(() => null);
      const token = randomToken(16);
      const now = new Date().toISOString();
      const t = {
        token,
        name: (body && body.name) || '未命名令牌',
        enabled: true,
        allowedChannels: (body && body.allowedChannels) || [],
        createdAt: now,
        expiresAt: (body && body.expiresAt) || null,
      };
      await store.put(KV_KEYS.token(token), t); // 唯一 KV 写入点之一
      return json({ ok: true, token: serializeToken(t) }, 201, cors);
    }

    return json({ ok: false, error: '方法不支持' }, 405, cors);
  });