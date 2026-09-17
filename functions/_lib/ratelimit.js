// 进程内存限流（滑动窗口）
// 设计：不写 KV —— isolate 内存 Map，重启归零，仅用于防误刷。
// 代价与取舍：限流计数不跨 isolate、不持久化，见 README「免费额度红线」。

const WINDOW_MS = 60 * 1000;
// 过期清理间隔：Map 涨得慢，定期清理即可
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// 全局兜底：单 isolate 总请求保护
// key -> { timestamps: number[] }
const buckets = new Map();

let lastCleanup = Date.now();

function cleanup(now) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
      continue;
    }
    const newest = bucket.timestamps[bucket.timestamps.length - 1];
    if (now - newest > WINDOW_MS) buckets.delete(key);
  }
}

/**
 * 滑动窗口限流。
 * @param {string} key 维度 key（如 token 或 ip）
 * @param {number} limit 窗口内允许的次数
 * @returns {boolean} true = 放行
 */
export function slidingWindow(key, limit) {
  const now = Date.now();
  cleanup(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  const arr = bucket.timestamps;
  // 移除窗口外的旧时间戳
  while (arr.length && now - arr[0] >= WINDOW_MS) arr.shift();
  if (arr.length >= limit) return false;
  arr.push(now);
  return true;
}

/** 仅为测试/自省提供 */
export function _bucketSize(key) {
  const b = buckets.get(key);
  return b ? b.timestamps.length : 0;
}