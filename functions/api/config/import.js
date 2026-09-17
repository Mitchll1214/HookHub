// /api/config/import —— 导入 JSON 恢复（一次性批量写）
// 只接受白名单前缀的 key，避免把任意内容写入 KV。

import { withAdmin } from '../_lib.js';
import { json } from '../../_lib/http.js';

const allowedPrefix = /^(token:|channel:|route:|group:|settings:global$)/;

export const onRequestPost = (context) =>
  withAdmin(context, async ({ store, cors }) => {
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body.config !== 'object') {
      return json({ ok: false, error: '请求体需包含 config 对象' }, 400, cors);
    }
    const cfg = body.config;
    let count = 0;
    let skipped = 0;
    for (const [k, v] of Object.entries(cfg)) {
      if (!allowedPrefix.test(k) || v == null) { skipped++; continue; }
      if (typeof v !== 'object') { skipped++; continue; }
      await store.put(k, v); // 唯一 KV 写入点之一
      count++;
    }
    return json({ ok: true, imported: count, skipped }, 200, cors);
  });