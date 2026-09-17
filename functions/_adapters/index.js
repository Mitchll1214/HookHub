// 适配器注册表：统一加载 + 元信息 + 调用

import { renderTemplate } from '../_lib/template.js';
import * as bark from './bark.js';
import * as serverchan from './serverchan.js';
import * as pushplus from './pushplus.js';
import * as wecom from './wecom.js';
import * as dingtalk from './dingtalk.js';
import * as feishu from './feishu.js';
import * as telegram from './telegram.js';
import * as ntfy from './ntfy.js';
import * as gotify from './gotify.js';
import * as discord from './discord.js';
import * as slack from './slack.js';
import * as resend from './resend.js';
import * as custom from './custom.js';

export const adapters = [
  bark, serverchan, pushplus, wecom, dingtalk, feishu,
  telegram, ntfy, gotify, discord, slack, resend, custom,
];

/** type -> 适配器模块 */
export const registry = Object.fromEntries(adapters.map((a) => [a.id, a]));

/** 适配器元信息（不含实现，供 /api/meta 和前端使用） */
export const adapterMeta = adapters.map((a) => ({
  id: a.id,
  name: a.name,
  description: a.description,
  maxLength: a.maxLength,
  contentType: a.contentType,
  fields: a.fields,
  defaultLevelMap: a.defaultLevelMap,
}));

/**
 * 调用渠道适配器。
 * 只处理已启用渠道；channel 对象需包含 id / type / config / levelMap。
 */
export async function dispatchChannel(channel, message, { timeoutMs, retries }) {
  const adapter = registry[channel.type];
  if (!adapter) {
    return { channel: channel.id, type: channel.type, ok: false, status: 0, error: `未知渠道类型: ${channel.type}` };
  }
  // 渠道级模板：如果有模板，先用它渲染出目标消息的 title/body 再交给适配器
  let targetMessage = message;
  if (channel.template && (channel.template.title || channel.template.body)) {
    targetMessage = {
      ...message,
      title: channel.template.title
        ? renderTemplate(channel.template.title, message)
        : message.title,
      body: channel.template.body
        ? renderTemplate(channel.template.body, message)
        : message.body,
    };
  }
  const result = await adapter.send(channel, targetMessage, { timeoutMs, retries });
  return {
    channel: channel.id,
    type: channel.type,
    ok: result.ok,
    status: result.status,
    error: result.error || '',
    raw: result.body || '',
  };
}

/** 批量并行分发（fan-out），用 allSettled 聚合 */
export async function fanOut(channels, message, opts) {
  const results = await Promise.allSettled(
    channels.map((ch) => dispatchChannel(ch, message, opts))
  );
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : {
    channel: channels[i].id,
    type: channels[i].type,
    ok: false,
    status: 0,
    error: r.reason && r.reason.message ? r.reason.message : String(r.reason),
  }));
}