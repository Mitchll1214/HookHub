// ============================================================
// KV 读写封装 —— 含内存缓存（60s TTL）与【写入点白名单】
//
// ⚠️ 全系统唯一允许的 KV 写入点只有下列 key 前缀/名字。
//    任何其他代码路径调用 put/delete 都会被这里直接拦截抛错。
//    红线：webhook 请求路径上不允许出现任何 KV 写。
// ============================================================

// 白名单：字符串 = 精确匹配；正则 = 前缀匹配
const WRITE_ALLOWLIST = [
  /^token:/,        // token:{token}            令牌元数据
  /^channel:/,      // channel:{id}             渠道配置
  /^route:/,        // route:{id}               路由规则
  'routes:index',   // （保留）
  /^group:/,        // group:{name}             渠道组
  'settings:global', // 全局设置
];

const CACHE_TTL_MS = 60 * 1000;

function isAllowedKey(key) {
  return WRITE_ALLOWLIST.some((p) =>
    typeof p === 'string' ? p === key : p.test(key)
  );
}

function blockWrite(key) {
  throw new Error(`[HARD_RULE] KV 写入被白名单拦截: "${key}"（仅后台配置保存可写 KV）`);
}

export class ConfigStore {
  constructor(env) {
    if (!env || !env.KV_CONFIG) {
      throw new Error('缺少 KV_CONFIG 绑定');
    }
    this.kv = env.KV_CONFIG;
    this.cache = new Map(); // key -> { ts, value }
  }

  /** 读取（带内存缓存）；读不到返回 null */
  async get(key, { ttl = CACHE_TTL_MS } = {}) {
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && now - hit.ts < ttl) return hit.value;
    let value = null;
    try {
      value = await this.kv.get(key, 'json');
    } catch {
      value = null;
    }
    this.cache.set(key, { ts: now, value });
    return value;
  }

  /** 写入（白名单内才允许）；同时刷新缓存 */
  async put(key, value) {
    if (!isAllowedKey(key)) blockWrite(key);
    await this.kv.put(key, JSON.stringify(value));
    this.cache.set(key, { ts: Date.now(), value });
  }

  /** 删除（白名单内才允许）；同时清缓存 */
  async delete(key) {
    if (!isAllowedKey(key)) blockWrite(key);
    await this.kv.delete(key);
    this.cache.delete(key);
  }

  /** 按前缀枚举 key（仅后台管理用，读取量大不到哪去） */
  async listKeys(prefix) {
    const out = [];
    let cursor;
    do {
      const page = await this.kv.list({ prefix, cursor });
      out.push(...page.keys.map((k) => k.name));
      cursor = page.cursor;
    } while (cursor);
    return out;
  }
}