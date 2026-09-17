// 统一 HTTP 响应 / CORS 工具

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

/**
 * 计算 CORS 响应头。
 * settings.cors: { allowAll: boolean, origins: string[] }
 * 返回 null 表示该来源不在白名单内（请求应被拒绝）。
 */
export function corsHeaders(settings, request) {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  const cors = (settings && settings.cors) || { allowAll: true, origins: [] };
  let allowOrigin = '*';
  if (!cors.allowAll) {
    const list = Array.isArray(cors.origins) ? cors.origins : [];
    if (!list.includes(origin)) return null;
    allowOrigin = origin;
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, Authorization, X-Signature, X-Timestamp',
    'Access-Control-Max-Age': '86400',
  };
}