// /api/config/export —— 导出全部配置为 JSON（纯读取，不写 KV）

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';

export const onRequestGet = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const keys = await store.listKeys('');
    const data = {};
    for (const k of keys) {
      if (k === 'routes:index') continue;
      const v = await store.get(k);
      if (v != null) data[k] = v;
    }
    return json({ ok: true, config: data }, 200, cors);
  });