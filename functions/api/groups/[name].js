// /api/groups/[name] —— 单个渠道组：更新 / 删除

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';
import { KV_KEYS } from '../../_lib/core.js';

function serializeGroup(g) {
  return {
    name: g.name,
    channels: (g.channels || []).map((c) => (c.startsWith('channel:') ? c.slice(8) : c)),
    enabled: g.enabled !== false,
  };
}

export const onRequestPut = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const name = context.params.name;
    const g = await store.get(KV_KEYS.group(name));
    if (!g) return json({ ok: false, error: '渠道组不存在' }, 404, cors);
    const body = await context.request.json().catch(() => null);
    if (!body) return json({ ok: false, error: '请求体不是 JSON' }, 400, cors);
    const updated = {
      ...g,
      channels: body.channels != null ? body.channels.map((c) => (c.startsWith('channel:') ? c.slice(8) : c)) : g.channels,
      enabled: body.enabled != null ? body.enabled : g.enabled,
    };
    await store.put(KV_KEYS.group(name), updated); // 唯一 KV 写入点之一
    return json({ ok: true, group: serializeGroup(updated) }, 200, cors);
  });

export const onRequestDelete = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const name = context.params.name;
    const g = await store.get(KV_KEYS.group(name));
    if (!g) return json({ ok: false, error: '渠道组不存在' }, 404, cors);
    await store.delete(KV_KEYS.group(name)); // 唯一 KV 删除点之一
    return json({ ok: true }, 200, cors);
  });