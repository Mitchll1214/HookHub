// 管理后台 API 的公共鉴权 + CORS + 工具
// 所有 /api/* 管理端点都从这里拿 store / settings / admin 校验结果。

import { ConfigStore } from '../_lib/kv.js';
import { getSettings } from '../_lib/core.js';
import { timingSafeEqual } from '../_lib/crypto.js';
import { json, corsHeaders } from '../_lib/http.js';

/**
 * 标准 API 入口包装：校验 admin 密码、注入 store/settings、统一 CORS。
 * @param {object} context Pages Functions 上下文
 * @param {Function} handler async ({context, store, settings, isAdmin, cors}) => Response
 * @param {{adminOnly?: boolean}} options adminOnly=false 时允许未登录访问（读取类）
 */
export async function withAdmin(context, handler, { adminOnly = true } = {}) {
  const { request, env } = context;

  // OPTIONS 预检统一放行（CORS 由响应头控制）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, Authorization, X-Signature, X-Timestamp',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  let store;
  try {
    store = new ConfigStore(env);
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }

  const settings = await getSettings(store);
  const ch = corsHeaders(settings, request);
  if (ch === null) {
    return json({ ok: false, error: '来源不在 CORS 白名单' }, 403);
  }

  const adminPassword = env.ADMIN_PASSWORD || '';
  let isAdmin = false;
  if (adminPassword) {
    const header = request.headers.get('X-Admin-Password') || '';
    const auth = request.headers.get('Authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const candidate = header || bearer;
    if (candidate) {
      isAdmin = await timingSafeEqual(candidate, adminPassword);
    }
  }

  if (adminOnly && !isAdmin) {
    // 失败即 401，不记录（无日志设计）
    return json({ ok: false, error: '未授权：缺少或错误的 X-Admin-Password' }, 401, ch);
  }

  return handler({ context, store, settings, isAdmin, cors: ch });
}