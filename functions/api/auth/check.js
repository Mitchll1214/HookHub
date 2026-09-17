// /api/auth/check —— 仅用于后台「登录」时校验 ADMIN_PASSWORD 是否正确
// 调用者带 X-Admin-Password；返回 { ok:true } 表示密码通过。
// 说明：实际写操作仍要求每次请求都带密码（无会话，无状态）。
//
// 特别处理：登录校验【不依赖 KV】。即使 KV 绑定尚未生效（环境变量配置期），
// 也返回 kvOk/kvError，让前端能区分「密码不对」和「KV 未绑定」两种问题。

import { withAdmin } from '../_lib.js';

export const onRequest = (context) =>
  withAdmin(context, async ({ isAdmin, cors, kvOk, kvError }) => {
    return new Response(JSON.stringify({ ok: isAdmin, kvOk, kvError: kvError || null }), {
      status: isAdmin ? 200 : 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
    });
  }, { adminOnly: false, requireStore: false });