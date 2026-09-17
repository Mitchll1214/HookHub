// /api/tokens/[token] —— 单个令牌：查看 / 更新（启用、白名单）/ 删除

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';
import { KV_KEYS } from '../../_lib/core.js';

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

export const onRequestGet = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const token = context.params.token;
    const t = await store.get(KV_KEYS.token(token));
    if (!t) return json({ ok: false, error: '令牌不存在' }, 404, cors);
    return json({ ok: true, token: serializeToken(t) }, 200, cors);
  });

export const onRequestPut = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const token = context.params.token;
    const t = await store.get(KV_KEYS.token(token));
    if (!t) return json({ ok: false, error: '令牌不存在' }, 404, cors);
    const body = await context.request.json().catch(() => null);
    if (!body) return json({ ok: false, error: '请求体不是 JSON' }, 400, cors);

    const updated = {
      ...t,
      name: body.name != null ? body.name : t.name,
      enabled: body.enabled != null ? body.enabled : t.enabled,
      allowedChannels: body.allowedChannels != null ? body.allowedChannels : t.allowedChannels,
      expiresAt: Object.prototype.hasOwnProperty.call(body, 'expiresAt') ? body.expiresAt : t.expiresAt,
    };
    await store.put(KV_KEYS.token(token), updated); // 唯一 KV 写入点之一
    return json({ ok: true, token: serializeToken(updated) }, 200, cors);
  });

export const onRequestDelete = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const token = context.params.token;
    const t = await store.get(KV_KEYS.token(token));
    if (!t) return json({ ok: false, error: '令牌不存在' }, 404, cors);
    await store.delete(KV_KEYS.token(token)); // 唯一 KV 删除点之一
    return json({ ok: true }, 200, cors);
  });