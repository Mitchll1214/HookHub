// /api/settings —— 全局设置：读取 + 更新 + 初始化

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';
import { KV_KEYS } from '../../_lib/core.js';
import { DEFAULT_SETTINGS } from '../../_lib/core.js';

export const onRequestGet = (context) =>
  withAdmin(context, async ({ store, cors, settings }) => {
    return json({ ok: true, settings }, 200, cors);
  }, { adminOnly: false });

export const onRequestPost = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const body = await context.request.json().catch(() => null);
    if (!body) return json({ ok: false, error: '请求体不是 JSON' }, 400, cors);

    // “初始化”：写入默认 settings + 示例路由（仅在 settings 尚不存在时执行）
    const existing = await store.get(KV_KEYS.settings);
    if (existing) return json({ ok: false, error: '系统已初始化' }, 409, cors);

    const now = new Date().toISOString();
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(body.settings || {}),
      createdAt: now,
    };
    await store.put(KV_KEYS.settings, settings); // 唯一 KV 写入点之一

    // 顺手创建一条示例路由（"全部消息 → 默认渠道"，用户可编辑）
    const routeId = 'route-default';
    const existingRoute = await store.get(KV_KEYS.route(routeId));
    if (!existingRoute) {
      await store.put(KV_KEYS.route(routeId), {
        id: routeId,
        name: '默认路由（匹配所有消息）',
        enabled: true,
        when: {},
        targets: (settings.defaultChannels || []).map((c) => `channel:${c}`),
        parallel: true,
        failover: [],
        priority: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    return json({ ok: true, settings }, 201, cors);
  });

export const onRequestPut = (context) =>
  withAdmin(context, async ({ store, cors, settings }) => {
    const body = await context.request.json().catch(() => null);
    if (!body) return json({ ok: false, error: '请求体不是 JSON' }, 400, cors);
    const merged = {
      ...settings,
      ...body,
      cors: { ...(settings.cors || {}), ...(body.cors || {}) },
      signature: { ...(settings.signature || {}), ...(body.signature || {}) },
    };
    await store.put(KV_KEYS.settings, merged); // 唯一 KV 写入点之一
    return json({ ok: true, settings: merged }, 200, cors);
  });