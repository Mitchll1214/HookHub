// 请求归一化单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInput } from '../functions/_lib/normalize.js';

test('合法 JSON body 正常归一化', () => {
  const body = JSON.stringify({
    title: '服务器报警',
    body: '磁盘使用率超过 90%',
    level: 'error',
    channel: 'bark',
    targets: ['group:oncall'],
    tags: ['disk', 'prod'],
    url: 'https://example.com',
    data: { host: 'web-01' },
  });
  const r = normalizeInput(null, body, 'application/json');
  assert.equal(r.ok, true);
  assert.equal(r.payload.title, '服务器报警');
  assert.equal(r.payload.body, '磁盘使用率超过 90%');
  assert.equal(r.payload.level, 'error');
  assert.equal(r.payload.channel, 'bark');
  assert.deepEqual(r.payload.targets, ['group:oncall']);
  assert.deepEqual(r.payload.tags, ['disk', 'prod']);
  assert.equal(r.payload.url, 'https://example.com');
  assert.deepEqual(r.payload.data, { host: 'web-01' });
});

test('声明 application/json 但带 // 注释 → 报错不降级', () => {
  const body = `{
    "title": "服务器报警",
    "level": "error",   // info | success | warning | error
    "data": { "host": "web-01" } // 注释
  }`;
  const r = normalizeInput(null, body, 'application/json');
  assert.equal(r.ok, false);
  assert.match(r.error, /JSON/);
  assert.match(r.error, /注释/);
});

test('声明 application/json 但语法错误 → 报错不降级', () => {
  const r = normalizeInput(null, '{invalid json', 'application/json');
  assert.equal(r.ok, false);
});

test('text/plain 原样作为 body（不报错）', () => {
  const r = normalizeInput(null, '纯文本消息', 'text/plain');
  assert.equal(r.ok, true);
  assert.equal(r.payload.body, '纯文本消息');
});

test('未声明类型且是合法 JSON → 按 JSON 解析', () => {
  const r = normalizeInput(null, '{"title":"T","body":"B"}', '');
  assert.equal(r.ok, true);
  assert.equal(r.payload.title, 'T');
  assert.equal(r.payload.body, 'B');
});

test('未声明类型且不是 JSON → 降级为纯文本', () => {
  const r = normalizeInput(null, '{不是合法json{', '');
  assert.equal(r.ok, true);
  assert.equal(r.payload.body, '{不是合法json{');
});

test('form-urlencoded body 归一化', () => {
  const r = normalizeInput(null, 'title=标题&body=正文&level=warning', 'application/x-www-form-urlencoded');
  assert.equal(r.ok, true);
  assert.equal(r.payload.title, '标题');
  assert.equal(r.payload.body, '正文');
  assert.equal(r.payload.level, 'warning');
});

test('GET query 参数归一化', () => {
  const q = new URLSearchParams('title=标题&body=正文&level=error&data={"a":1}');
  const r = normalizeInput(q, null, '');
  assert.equal(r.ok, true);
  assert.equal(r.payload.title, '标题');
  assert.equal(r.payload.level, 'error');
  assert.deepEqual(r.payload.data, { a: 1 });
});