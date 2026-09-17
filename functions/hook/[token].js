// /hook/[token] —— 通用 Webhook 入口
//
// 流程：归一化 → 限流（内存滑动窗口）→ 可选 HMAC 校验 → 令牌校验 →
//       读取配置 → 路由匹配 + fan-out 分发 → 统一响应
//
// ⚠️ 本路径上【禁止任何 KV 写入】——详见 README「免费额度红线」。

import { ConfigStore } from '../_lib/kv.js';
import { getSettings, getToken, tokenAllowsChannel } from '../_lib/core.js';
import { json, corsHeaders } from '../_lib/http.js';
import { hmacSha256, timingSafeEqual } from '../_lib/crypto.js';
import { slidingWindow } from '../_lib/ratelimit.js';
import { normalizeInput } from '../_lib/normalize.js';
import { dispatch } from '../_lib/dispatch.js';

const MAX_BODY_BYTES = 64 * 1024; // 64KB 上限
const REQ_LIMIT_PER_TOKEN = 60;   // 每 token 每分钟 60 次（内存）
const GLOBAL_LIMIT = 3000;        // 单 isolate 每分钟总量保护

export async function onRequest(context) {
  const { request, env, params } = context;
  const token = params.token;

  // ---- CORS（默认 *，可配白名单）----
  let store;
  try {
    store = new ConfigStore(env);
  } catch (e) {
    return json({ ok: false, error: '服务未配置: ' + e.message }, 500);
  }
  const settings = await getSettings(store);
  const cors = corsHeaders(settings, request);

  // OPTIONS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // ---- 方法限制：仅 GET / POST ----
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ ok: false, error: '仅支持 GET / POST' }, 405, cors);
  }

  // ---- 内存限流（不写 KV）----
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const tokenKey = `token:${token}`;
  if (!slidingWindow(tokenKey, REQ_LIMIT_PER_TOKEN)) {
    return json({ ok: false, error: '请求过于频繁（该令牌每分钟限 60 次）' }, 429, cors);
  }
  if (!slidingWindow(`global:${ip}`, GLOBAL_LIMIT)) {
    return json({ ok: false, error: '请求过于频繁（全局保护）' }, 429, cors);
  }

  // ---- 读取 body（大小受限）----
  let searchParams = null;
  let bodyText = null;
  let contentType = '';
  const url = new URL(request.url);
  if (request.method === 'GET') {
    searchParams = url.searchParams;
  } else {
    // 读取 body 前先确认大小
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: `请求体超过 ${MAX_BODY_BYTES} 字节上限` }, 413, cors);
    }
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: `请求体超过 ${MAX_BODY_BYTES} 字节上限` }, 413, cors);
    }
    bodyText = new TextDecoder().decode(buf);
    contentType = request.headers.get('Content-Type') || '';
  }

  // ---- 归一化 ----
  const norm = normalizeInput(searchParams, bodyText, contentType);
  if (!norm.ok) return json({ ok: false, error: norm.error }, 400, cors);
  const payload = norm.payload;

  // ---- 可选 HMAC 签名校验（X-Signature，纯计算无存储）----
  if (settings.signature && settings.signature.enabled && env.SIGN_SECRET) {
    const sig = request.headers.get('X-Signature') || '';
    const ts = request.headers.get('X-Timestamp') || '';
    if (!sig || !ts) {
      return json({ ok: false, error: '缺少 X-Signature / X-Timestamp' }, 401, cors);
    }
    // 时间戳容差 5 分钟
    const tsNum = Number(ts);
    if (!tsNum || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
      return json({ ok: false, error: 'X-Timestamp 过期或无效' }, 401, cors);
    }
    const expected = await hmacSha256(env.SIGN_SECRET, `${ts}\n${bodyText || ''}`);
    const ok = await timingSafeEqual(sig, expected);
    if (!ok) {
      return json({ ok: false, error: '签名校验失败' }, 401, cors);
    }
  }

  // ---- 令牌校验 ----
  const tok = await getToken(store, token);
  if (!tok) return json({ ok: false, error: '令牌不存在' }, 404, cors);
  if (tok.enabled === false) return json({ ok: false, error: '令牌已禁用' }, 403, cors);
  if (tok.expiresAt) {
    const exp = new Date(tok.expiresAt).getTime();
    if (!Number.isNaN(exp) && Date.now() > exp) {
      return json({ ok: false, error: '令牌已过期' }, 403, cors);
    }
  }

  // ---- 渠道白名单校验 ----
  // payload.channel 可指定单个目标渠道；若不匹配白名单则拒绝
  if (payload.channel && !tokenAllowsChannel(tok, payload.channel)) {
    return json({ ok: false, error: `令牌无权使用渠道: ${payload.channel}` }, 403, cors);
  }
  // targets 白名单过滤：仅保留白名单内的渠道/组
  if (payload.targets && payload.targets.length) {
    const allowed = (tok.allowedChannels || []).map((c) => (c.startsWith('channel:') ? c.slice(8) : c));
    if (allowed.length) {
      const filtered = payload.targets.filter((t) =>
        t.startsWith('group:') || allowed.includes(t.replace(/^channel:/, ''))
      );
      if (filtered.length === 0) {
        return json({ ok: false, error: 'targets 均不在令牌白名单内' }, 403, cors);
      }
      payload.targets = filtered;
    }
  }

  // ---- 读取路由并分发 ----
  const routes = [];
  const routeKeys = await store.listKeys('route:');
  for (const k of routeKeys) {
    if (k === 'routes:index') continue;
    const r = await store.get(k);
    if (r && r.enabled !== false) routes.push(r);
  }

  const opts = {
    timeoutMs: settings.timeoutMs || 8000,
    retries: settings.retries != null ? settings.retries : 2,
  };

  const result = await dispatch(store, routes, payload, settings, opts);

  // ---- 统一响应：{"ok":true,"results":[...]}；不落地任何持久状态 ----
  const allOk = result.results.every((r) => r.ok);
  return json(
    {
      ok: allOk,
      matched: result.matched,
      route: result.route,
      results: result.results.map((r) => ({
        channel: r.channel,
        type: r.type || '',
        ok: r.ok,
        status: r.status,
        error: r.error || undefined,
      })),
    },
    allOk ? 200 : 502,
    cors
  );
}