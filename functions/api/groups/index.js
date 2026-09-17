// /api/groups —— 渠道组管理：列表 + 新增 + 更新 + 删除
// 渠道组用于「一次配置、多处复用」，如 group:oncall = Bark + 企微 + Telegram

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';
import { KV_KEYS } from '../../_lib/core.js';

const PREFIX = 'group:';

function serializeGroup(g) {
  return {
    name: g.name,
    channels: (g.channels || []).map((c) => (c.startsWith('channel:') ? c.slice(8) : c)),
    enabled: g.enabled !== false,
  };
}

export const onRequest = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const method = context.request.method;

    if (method === 'GET') {
      const keys = await store.listKeys(PREFIX);
      const groups = [];
      for (const k of keys) {
        const g = await store.get(k);
        if (g) groups.push(serializeGroup(g));
      }
      return json({ ok: true, groups }, 200, cors);
    }

    if (method === 'POST') {
      const body = await context.request.json().catch(() => null);
      const name = body && body.name;
      if (!name) return json({ ok: false, error: '缺少组名' }, 400, cors);
      const existing = await store.get(KV_KEYS.group(name));
      if (existing) return json({ ok: false, error: '同名渠道组已存在' }, 409, cors);
      const g = {
        name,
        channels: (body.channels || []).map((c) => (c.startsWith('channel:') ? c.slice(8) : c)),
        enabled: body.enabled !== false,
      };
      await store.put(KV_KEYS.group(name), g); // 唯一 KV 写入点之一
      return json({ ok: true, group: serializeGroup(g) }, 201, cors);
    }

    return json({ ok: false, error: '方法不支持' }, 405, cors);
  });