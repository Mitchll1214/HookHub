// 核心数据访问：统一读配置（带缓存）+ 常用工具函数

export const KV_KEYS = {
  token: (t) => `token:${t}`,
  channel: (id) => `channel:${id}`,
  route: (id) => `route:${id}`,
  group: (name) => `group:${name}`,
  settings: 'settings:global',
  routesIndex: 'routes:index',
};

// 默认全局设置（首次初始化时写入 KV，之后可被后台修改）
export const DEFAULT_SETTINGS = {
  schemaVersion: 1,
  defaultChannels: [],       // 未匹配任何路由时的兜底渠道 id 列表
  cors: { allowAll: true, origins: [] }, // CORS 设置
  signature: { enabled: false },         // X-Signature HMAC 校验开关
  timeoutMs: 8000,                       // 渠道请求超时
  retries: 2,                            // 同请求内最多重试次数
  templateModeDefault: 'simple',         // 模板默认模式
  createdAt: null,
};

export async function getSettings(store) {
  const s = await store.get(KV_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(s || {}), createdAt: (s && s.createdAt) || null };
}

export async function getChannel(store, id) {
  return store.get(KV_KEYS.channel(id));
}

export async function getToken(store, token) {
  return store.get(KV_KEYS.token(token));
}

/** 令牌是否有权使用某渠道：白名单为空 = 全部可用 */
export function tokenAllowsChannel(token, channelId) {
  const wl = (token && token.allowedChannels) || [];
  if (!wl.length) return true;
  return wl.includes(channelId) || wl.includes('*');
}

/** 密钥脱敏：显示后 4 位，如 ****abcd */
export function maskSecret(secret) {
  if (!secret) return '';
  if (secret.length <= 4) return '****';
  return '****' + secret.slice(-4);
}

/** 截断字符串（按 UTF-16 code unit，够用） */
export function truncate(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

export function randomId(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function randomToken(len = 12) {
  return randomId(len);
}

/** 深层取值：'data.foo.bar' → payload.data.foo.bar */
export function getPath(obj, path) {
  if (path == null || path === '') return undefined;
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** 扁平化对象为 'a.b.c = value' 行（用于字段帮助） */
export function flattenPaths(obj, prefix = '', out = []) {
  if (obj == null) return out;
  if (typeof obj !== 'object') {
    out.push({ path: prefix, value: obj });
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      flattenPaths(v, path, out);
    } else {
      out.push({ path, value: Array.isArray(v) ? v.join(', ') : v });
    }
  }
  return out;
}