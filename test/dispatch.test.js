// 分发引擎 + 模板应用集成测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute, expandTargets, dispatch } from '../functions/_lib/dispatch.js';
import { renderTemplate } from '../functions/_lib/template.js';
import { dispatchChannel } from '../functions/_adapters/index.js';

test('matchRoute 各条件', () => {
  const payload = { channel: 'bark', level: 'error', tags: ['disk', 'prod'], data: { host: 'web-01' } };
  assert.equal(matchRoute({ when: { level: 'error' } }, payload), true);
  assert.equal(matchRoute({ when: { level: 'info' } }, payload), false);
  assert.equal(matchRoute({ when: { tags: ['disk', 'prod'] } }, payload), true);
  assert.equal(matchRoute({ when: { tags: ['disk', 'test'] } }, payload), false);
  assert.equal(matchRoute({ when: { data: { key: 'data.host', value: 'web-01' } } }, payload), true);
  assert.equal(matchRoute({ when: {} }, payload), true);
});

// 简易内存 store（结构与 ConfigStore 兼容）
function makeStore(init) {
  const map = new Map(Object.entries(init || {}));
  return {
    async get(k) {
      return map.has(k) ? map.get(k) : null;
    },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
  };
}

test('dispatch: 命中路由 fan-out 到目标渠道', async () => {
  const store = makeStore({
    'channel:b1': { id: 'b1', type: 'bark', name: 'Bark', enabled: true, config: { deviceKey: 'x' } },
    'channel:t1': { id: 't1', type: 'telegram', name: 'TG', enabled: true, config: { botToken: 'a', chatId: 'b' } },
    'group:oncall': { name: 'oncall', channels: ['b1', 't1'], enabled: true },
  });
  const routes = [{
    id: 'r1', name: '值班', enabled: true,
    when: { level: 'error' },
    targets: ['group:oncall'],
    failover: [],
    priority: 1,
  }];
  const result = await dispatch(store, routes, { title: 't', body: 'b', level: 'error', tags: [], data: {} }, { defaultChannels: [] }, { timeoutMs: 500, retries: 0 });
  assert.equal(result.matched, true);
  assert.equal(result.results.length, 2); // b1 + t1
  assert.deepEqual(result.results.map((r) => r.channel).sort(), ['b1', 't1']);
});

test('dispatch: 未命中走默认兜底', async () => {
  const store = makeStore({
    'channel:b1': { id: 'b1', type: 'bark', name: 'Bark', enabled: true, config: { deviceKey: 'x' } },
  });
  const result = await dispatch(store, [], { title: 't', body: 'b', level: 'info', tags: [], data: {} },
    { defaultChannels: ['b1'] }, { timeoutMs: 500, retries: 0 });
  assert.equal(result.matched, false);
  assert.equal(result.route, '默认兜底');
  assert.equal(result.results.length, 1);
});

test('dispatchChannel: 渠道级模板渲染 title/body', async () => {
  const channel = {
    id: 'c1', type: 'custom', name: 'Custom', enabled: true,
    config: { url: 'https://example.com/x' },
    template: { title: '{{title}}!', body: '[{{level|upper}}] {{body}} @{{data.host}}' },
  };
  const store = makeStore({ 'channel:c1': channel });
  const routes = [{ id: 'r', name: 'x', enabled: true, when: {}, targets: ['channel:c1'], failover: [], priority: 1 }];
  const result = await dispatch(store, routes,
    { title: '告警', body: '磁盘满', level: 'error', tags: [], data: { host: 'web-01' } },
    { defaultChannels: [] }, { timeoutMs: 500, retries: 0 });
  // 因为 URL 不可达，结果 ok=false 但可以验证错误信息里不含渲染残留（渲染已在适配器内完成）
  assert.equal(result.results.length, 1);
  // 直接调用 dispatchChannel 验证渲染逻辑（用 stub 替代真实发送）
  const captured = [];
  const stub = { send: async (ch, msg) => { captured.push(msg); return { ok: true, status: 200, body: '{}' }; } };
  const origRegistry = (await import('../functions/_adapters/index.js')).registry;
  origRegistry.custom = stub;
  const r2 = await dispatchChannel(channel,
    { title: '告警', body: '磁盘满', level: 'error', tags: [], data: { host: 'web-01' } },
    { timeoutMs: 500, retries: 0 });
  assert.equal(r2.ok, true);
  assert.equal(captured[0].title, '告警!');
  assert.equal(captured[0].body, '[ERROR] 磁盘满 @web-01');
});

test('模板在渲染链路里被真正使用（渲染器本身）', () => {
  const out = renderTemplate('{{#if level=="error"}}{{title|upper}}{{/if}}', { title: 'disk', level: 'error' });
  assert.equal(out, 'DISK');
});