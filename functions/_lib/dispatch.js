// 消息分发核心：路由匹配 + 并行分发 + 降级链 + 渠道组展开
//
// 数据模型：
//   route = {
//     id, name, enabled,
//     when: { channel, level, tags: [], data: { key, value } },  // 空 = 匹配所有
//     targets: ['channel:xxx', 'group:yyy'],                    // 目标（渠道或渠道组）
//     parallel: true,                                           // 并行开关
//     failover: ['channel:zzz'],                                // 降级链（主目标全部失败后的备用）
//     priority: 0,                                              // 优先级（数字大优先）
//   }
//   group = { name, channels: ['channel:xxx', ...], enabled }
//   settings.defaultChannels = ['channel:xxx'] 兜底

import { getChannel, getPath, KV_KEYS } from './core.js';
import { fanOut } from '../_adapters/index.js';

export function matchRoute(route, payload) {
  const w = route.when || {};
  // channel 字段匹配
  if (w.channel && w.channel !== payload.channel) return false;
  // level 匹配
  if (w.level && w.level !== payload.level) return false;
  // tags 匹配：路由要求的所有 tag 都在 payload.tags 中
  if (w.tags && w.tags.length) {
    const tags = payload.tags || [];
    if (!w.tags.every((t) => tags.includes(t))) return false;
  }
  // data.key/value 匹配
  if (w.data && w.data.key) {
    const ctx = { title: payload.title, body: payload.body, level: payload.level, channel: payload.channel, targets: payload.targets, tags: payload.tags || [], url: payload.url, data: payload.data || {} };
    const actual = getPath(ctx, w.data.key);
    if (String(actual == null ? '' : actual) !== String(w.data.value == null ? '' : w.data.value)) return false;
  }
  return true;
}

/**
 * 解析目标列表（含群组展开 + 去重），返回渠道 id 数组。
 */
export async function expandTargets(store, targetRefs) {
  const out = [];
  const seen = new Set();
  const add = (id) => {
    if (!seen.has(id)) { seen.add(id); out.push(id); }
  };
  for (const ref of targetRefs || []) {
    if (ref.startsWith('group:')) {
      const group = await store.get(KV_KEYS.group(ref.slice(6)));
      if (group && group.enabled !== false) {
        for (const c of (group.channels || [])) add(c);
      }
    } else if (ref.startsWith('channel:')) {
      add(ref.slice(8));
    } else {
      add(ref);
    }
  }
  return out;
}

/**
 * 给一组渠道 id 装载渠道配置对象并过滤未启用/不存在的。
 */
export async function loadEnabledChannels(store, ids) {
  const out = [];
  for (const id of ids) {
    const ch = await getChannel(store, id);
    if (ch && ch.enabled !== false) {
      out.push(ch);
    }
  }
  return out;
}

/**
 * 分发主逻辑。
 * @returns {Promise<{matched: boolean, results: Array}>}
 */
export async function dispatch(store, routes, payload, settings, opts = {}) {
  // 1. 匹配路由
  let matchedRoute = null;
  const enabledRoutes = (routes || []).filter((r) => r.enabled !== false);
  // 优先级正序（数值大优先）
  const sorted = [...enabledRoutes].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const r of sorted) {
    if (matchRoute(r, payload)) {
      matchedRoute = r;
      break;
    }
  }

  // 2. 收集目标渠道 id（主）
  let primaryIds = [];
  if (matchedRoute) {
    primaryIds = await expandTargets(store, matchedRoute.targets);
  } else {
    primaryIds = (settings.defaultChannels || []).map((c) => (c.startsWith('channel:') ? c.slice(8) : c));
  }

  // 3. 装载并分发
  const results = [];
  if (matchedRoute && matchedRoute.failover && matchedRoute.failover.length) {
    // 降级链：先并发发主目标，若有失败再补发备用
    const primaryChannels = await loadEnabledChannels(store, primaryIds);
    if (primaryChannels.length) {
      const r = await fanOut(primaryChannels, payload, opts);
      results.push(...r);
      const allFailed = r.every((x) => !x.ok);
      if (allFailed) {
        const backupIds = await expandTargets(store, matchedRoute.failover);
        const backupChannels = await loadEnabledChannels(store, backupIds);
        if (backupChannels.length) {
          const r2 = await fanOut(backupChannels, payload, opts);
          results.push(...r2);
        }
      }
    }
  } else {
    const channels = await loadEnabledChannels(store, primaryIds);
    if (channels.length) {
      const r = await fanOut(channels, payload, opts);
      results.push(...r);
    }
  }

  return { matched: !!matchedRoute, route: matchedRoute ? matchedRoute.name : '默认兜底', results };
}