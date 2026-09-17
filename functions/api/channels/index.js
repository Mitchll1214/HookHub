// /api/channels —— 渠道管理（列表 + 新增）
// /api/channels/[id] —— 单个渠道（读/改/删/测试）

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';
import { KV_KEYS, maskSecret, randomId } from '../../_lib/core.js';
import { registry } from '../../_adapters/index.js';

// 序列化给前端（脱敏）
function serializeChannel(ch, { full = false } = {}) {
  const out = {
    id: ch.id,
    name: ch.name,
    type: ch.type,
    enabled: ch.enabled !== false,
    createdAt: ch.createdAt,
    levelMap: ch.levelMap || {},
  };
  if (full) {
    out.config = ch.config || {};
  } else {
    // 脱敏：仅显示密钥字段的 ****后4位
    const cfg = ch.config || {};
    const meta = registry[ch.type];
    const masked = {};
    if (meta) {
      for (const f of meta.fields) {
        const v = cfg[f.key];
        if (v != null && v !== '') {
          masked[f.key] = /key|token|secret|password|sendkey|api/i.test(f.key) ? maskSecret(String(v)) : v;
        }
      }
    }
    out.configMasked = masked;
  }
  return out;
}

export const onRequest = (context) =>
  withAdmin(context, async ({ context, store }) => {
    const { request } = context;
    if (request.method === 'GET') {
      const keys = await store.listKeys('channel:');
      const channels = [];
      for (const k of keys) {
        const ch = await store.get(k);
        if (ch) channels.push(serializeChannel(ch));
      }
      channels.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return json({ ok: true, channels });
    }
    if (request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || !body.type || !registry[body.type]) {
        return json({ ok: false, error: '渠道类型无效' }, 400);
      }
      const meta = registry[body.type];
      // 校验必填字段
      for (const f of meta.fields) {
        if (f.required && !(body.config && body.config[f.key])) {
          return json({ ok: false, error: `缺少必填字段: ${f.label}` }, 400);
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
        createdAt: now,
        updatedAt: now,
      };
      await store.put(KV_KEYS.channel(id), ch); // 唯一 KV 写入点之一
      return json({ ok: true, channel: serializeChannel(ch, { full: true }) }, 201);
    }
    return json({ ok: false, error: '方法不支持' }, 405);
  }, { adminOnly: true });