// /api/routes/[id] —— 单个路由：更新 / 删除

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';
import { KV_KEYS } from '../../_lib/core.js';

function serializeRoute(r) {
  return {
    id: r.id,
    name: r.name || '未命名路由',
    enabled: r.enabled !== false,
    when: r.when || {},
    targets: r.targets || [],
    parallel: r.parallel !== false,
    failover: r.failover || [],
    priority: r.priority || 0,
  };
}

export const onRequestPut = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const id = context.params.id;
    const r = await store.get(KV_KEYS.route(id));
    if (!r) return json({ ok: false, error: '路由不存在' }, 404, cors);
    const body = await context.request.json().catch(() => null);
    if (!body) return json({ ok: false, error: '请求体不是 JSON' }, 400, cors);

    const updated = {
      ...r,
      name: body.name != null ? body.name : r.name,
      enabled: body.enabled != null ? body.enabled : r.enabled,
      when: body.when != null ? body.when : r.when,
      targets: body.targets != null ? body.targets : r.targets,
      parallel: body.parallel != null ? body.parallel : r.parallel,
      failover: body.failover != null ? body.failover : r.failover,
      priority: body.priority != null ? body.priority : r.priority,
      updatedAt: new Date().toISOString(),
    };
    await store.put(KV_KEYS.route(id), updated); // 唯一 KV 写入点之一
    return json({ ok: true, route: serializeRoute(updated) }, 200, cors);
  });

export const onRequestDelete = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const id = context.params.id;
    const r = await store.get(KV_KEYS.route(id));
    if (!r) return json({ ok: false, error: '路由不存在' }, 404, cors);
    await store.delete(KV_KEYS.route(id)); // 唯一 KV 删除点之一
    // 从索引移除
    const idx = (await store.get(KV_KEYS.routesIndex)) || { ids: [] };
    idx.ids = idx.ids.filter((x) => x !== id);
    await store.put(KV_KEYS.routesIndex, idx);
    return json({ ok: true }, 200, cors);
  });