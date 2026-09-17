// /api/meta —— 渠道适配器元信息（无需鉴权，供后台/页面渲染表单）

import { json } from '../_lib/http.js';
import { adapterMeta } from '../_adapters/index.js';

export const onRequest = () =>
  json({
    ok: true,
    adapters: adapterMeta,
    levels: ['info', 'success', 'warning', 'error'],
  });