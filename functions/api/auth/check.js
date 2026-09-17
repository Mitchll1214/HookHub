// /api/auth/check —— 仅用于后台「登录」时校验 ADMIN_PASSWORD 是否正确
// 调用者带 X-Admin-Password；返回 { ok:true } 表示密码通过。
// 说明：实际写操作仍要求每次请求都带密码（无会话，无状态）。

import { withAdmin } from '../_lib.js';

export const onRequest = (context) =>
  withAdmin(context, async ({ isAdmin, cors }) => {
    return new Response(JSON.stringify({ ok: isAdmin }), {
      status: isAdmin ? 200 : 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
    });
  }, { adminOnly: false });