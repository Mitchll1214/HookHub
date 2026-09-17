// 前端模板渲染器（public/js/template.js）与后端渲染器输出一致性测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderTemplate as backendRender } from '../functions/_lib/template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 在 node 中加载浏览器版渲染器（它挂在 window.HookHubTemplate 上）
globalThis.window = globalThis;
const src = readFileSync(join(__dirname, '../public/js/template.js'), 'utf-8');
// 用间接 eval 执行（测试环境专用）
(0, eval)(src);
const frontendRender = globalThis.HookHubTemplate.render;

const SAMPLE = {
  title: '磁盘使用率告警',
  body: '主机 web-01 /data 使用率 92%',
  level: 'error',
  tags: ['disk', 'prod'],
  data: { host: 'web-01', usage: 92 },
  url: 'https://example.com',
};

const cases = [
  '{{title}} · {{level|upper}}',
  '{{#if level=="error"}}🔴{{else}}✅{{/if}} {{title}}',
  '{{#each tags}}#{{this}} {{/each}}',
  '{{data.host}} / {{data.usage}}%',
  '{{missing|default:未知}}',
  '{{title|lower}}',
  '{{#if data.usage>90}}超阈值{{else}}正常{{/if}}',
  '{{body}}',
];

test('前后端模板渲染输出一致', () => {
  for (const tpl of cases) {
    const b = backendRender(tpl, SAMPLE);
    const f = frontendRender(tpl, SAMPLE);
    assert.equal(f, b, `模板「${tpl}」前后端输出不一致: backend=${JSON.stringify(b)} frontend=${JSON.stringify(f)}`);
  }
});