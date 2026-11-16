// /api/channels —— 渠道管理（列表 + 新增）
// 单渠道的读/改/删/测试见 [id]/index.js、[id]/test.js

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';
import { KV_KEYS, randomId } from '../../_lib/core.js';
import { registry } from '../../_adapters/index.js';
import { serializeChannel, byCreatedAtAsc } from '../_serialize.js';

export const onRequest = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const { request } = context;

    if (request.method === 'GET') {
      const keys = await store.listKeys('channel:');
      const channels = [];
      for (const k of keys) {
        const ch = await store.get(k);
        if (ch) channels.push(serializeChannel(ch));
      }
      // createdAt 是 ISO 字符串，用 localeCompare 比较；减号会得到 NaN 导致排序失效
      channels.sort(byCreatedAtAsc);
      return json({ ok: true, channels }, 200, cors);
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || !body.type || !registry[body.type]) {
        return json({ ok: false, error: '渠道类型无效' }, 400, cors);
      }
      const meta = registry[body.type];
      // 校验必填字段
      for (const f of meta.fields) {
        if (f.required && !(body.config && body.config[f.key])) {
          return json({ ok: false, error: `缺少必填字段: ${f.label}` }, 400, cors);
        }
      }
      const id = body.id || randomId();
      const now = new Date().toISOString();
      const ch = {
        id,
        name: body.name || meta.name,
        type: body.type,
        enabled: body.enabled !== false,
        config: body.config || {},
        levelMap: body.levelMap || {},
        template: body.template || null,
        createdAt: now,
        updatedAt: now,
      };
      await store.put(KV_KEYS.channel(id), ch); // 唯一 KV 写入点之一
      return json({ ok: true, channel: serializeChannel(ch, { full: true }) }, 201, cors);
    }

    return json({ ok: false, error: '方法不支持' }, 405, cors);
  }, { adminOnly: true });