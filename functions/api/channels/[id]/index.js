// /api/channels/[id]/ —— 单个渠道：读 / 改 / 删（测试发送见同目录 test.js）
// Pages Functions 中 [id].js 只匹配单路径段，故 CRUD 在此，/:id/test 拆分到 test.js。

import { withAdmin } from '../../_lib.js';
import { json } from '../../../_lib/http.js';
import { getChannel, maskSecret, KV_KEYS } from '../../../_lib/core.js';
import { registry } from '../../../_adapters/index.js';

function serializeChannel(ch, { full = false } = {}) {
  const out = {
    id: ch.id,
    name: ch.name,
    type: ch.type,
    enabled: ch.enabled !== false,
    createdAt: ch.createdAt,
    updatedAt: ch.updatedAt,
    levelMap: ch.levelMap || {},
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
          masked[f.key] = /key|token|secret|password|sendkey|api/i.test(f.key) ? maskSecret(String(v)) : v;
        }
      }
    }
    out.configMasked = masked;
  }
  return out;
}

// GET /api/channels/:id —— 单个渠道完整详情（含密钥，仅管理端）
export const onRequestGet = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const id = context.params.id;
    const ch = await getChannel(store, id);
    if (!ch) return json({ ok: false, error: '渠道不存在' }, 404, cors);
    return json({ ok: true, channel: serializeChannel(ch, { full: true }) }, 200, cors);
  });

// PUT /api/channels/:id —— 更新渠道
export const onRequestPut = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const id = context.params.id;
    const ch = await getChannel(store, id);
    if (!ch) return json({ ok: false, error: '渠道不存在' }, 404, cors);
    const body = await context.request.json().catch(() => null);
    if (!body) return json({ ok: false, error: '请求体不是 JSON' }, 400, cors);

    let config = ch.config || {};
    if (body.config && typeof body.config === 'object') {
      config = { ...config, ...body.config };
      // 脱敏占位（**** 开头）视为未修改，保留原值
      for (const [k, v] of Object.entries(body.config)) {
        if (typeof v === 'string' && v.startsWith('****')) {
          config[k] = ch.config ? ch.config[k] : '';
        }
      }
    }

    const updated = {
      ...ch,
      name: body.name != null ? body.name : ch.name,
      enabled: body.enabled != null ? body.enabled : ch.enabled,
      config,
      levelMap: body.levelMap != null ? body.levelMap : ch.levelMap,
      template: Object.prototype.hasOwnProperty.call(body, 'template') ? body.template : ch.template,
      mapping: body.mapping != null ? body.mapping : ch.mapping,
      updatedAt: new Date().toISOString(),
    };
    await store.put(KV_KEYS.channel(id), updated); // 唯一 KV 写入点之一
    return json({ ok: true, channel: serializeChannel(updated, { full: true }) }, 200, cors);
  });

// DELETE /api/channels/:id —— 删除渠道
export const onRequestDelete = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const id = context.params.id;
    const ch = await getChannel(store, id);
    if (!ch) return json({ ok: false, error: '渠道不存在' }, 404, cors);
    await store.delete(KV_KEYS.channel(id)); // 唯一 KV 删除点之一
    return json({ ok: true }, 200, cors);
  });
