// /api/channels/[id]/test —— 测试发送（不写 KV、不记日志）
// 独立文件：Pages Functions 中 [id].js 只匹配单路径段 /api/channels/:id，
// /:id/test 由 [id]/test.js 单独承载，否则 POST 落到无匹配路由返回 405。

import { withAdmin } from '../../_lib.js';
import { json } from '../../../_lib/http.js';
import { getChannel } from '../../../_lib/core.js';
import { registry } from '../../../_adapters/index.js';

export const onRequestPost = (context) =>
  withAdmin(context, async ({ store, cors, settings }) => {
    const id = context.params.id;
    const ch = await getChannel(store, id);
    if (!ch) return json({ ok: false, error: '渠道不存在' }, 404, cors);

    const mock = {
      title: 'HookHub 测试消息',
      body: '这是一条测试消息，用于验证渠道配置是否可用。\n\n发送时间: ' + new Date().toISOString(),
      level: 'info',
      channel: '',
      targets: [],
      tags: ['test'],
      url: '',
      data: { test: true, from: 'HookHub' },
    };
    const adapter = registry[ch.type];
    if (!adapter) return json({ ok: false, error: `未知渠道类型: ${ch.type}` }, 400, cors);
    const result = await adapter.send(ch, mock, {
      timeoutMs: settings.timeoutMs || 8000,
      retries: settings.retries != null ? settings.retries : 2,
    });
    return json({
      ok: result.ok,
      status: result.status,
      error: result.error || '',
      raw: result.body || '',
    }, result.ok ? 200 : 502, cors);
  });
