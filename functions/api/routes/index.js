// /api/routes —— 路由规则管理：列表 + 新增

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';
import { KV_KEYS, randomId } from '../../_lib/core.js';

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

export const onRequest = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const method = context.request.method;

    if (method === 'GET') {
      const keys = await store.listKeys('route:');
      const routes = [];
      for (const k of keys) {
        if (k === KV_KEYS.routesIndex) continue;
        const r = await store.get(k);
        if (r) routes.push(serializeRoute(r));
      }
      routes.sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.createdAt || '').localeCompare(b.createdAt || ''));
      return json({ ok: true, routes }, 200, cors);
    }

    if (method === 'POST') {
      const body = await context.request.json().catch(() => null);
      if (!body) return json({ ok: false, error: '请求体不是 JSON' }, 400, cors);
      const id = body.id || randomId();
      const now = new Date().toISOString();
      const r = {
        id,
        name: body.name || '未命名路由',
        enabled: body.enabled !== false,
        when: body.when || {},
        targets: body.targets || [],
        parallel: body.parallel !== false,
        failover: body.failover || [],
        priority: body.priority || 0,
        createdAt: now,
        updatedAt: now,
      };
      await store.put(KV_KEYS.route(id), r); // 唯一 KV 写入点之一
      // 维护索引（写入点白名单允许）
      const idx = (await store.get(KV_KEYS.routesIndex)) || { ids: [] };
      if (!idx.ids.includes(id)) {
        idx.ids.push(id);
        await store.put(KV_KEYS.routesIndex, idx);
      }
      return json({ ok: true, route: serializeRoute(r) }, 201, cors);
    }

    return json({ ok: false, error: '方法不支持' }, 405, cors);
  });