// 模板渲染器单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate, extractVars } from '../functions/_lib/template.js';

const data = {
  title: '磁盘报警',
  body: '使用率90%',
  level: 'error',
  tags: ['disk', 'prod'],
  data: { host: 'web-01' },
};

test('占位符与过滤器', () => {
  assert.equal(renderTemplate('{{title}} | {{level|upper}}', data), '磁盘报警 | ERROR');
  assert.equal(renderTemplate('{{data.host|default:unknown}}', data), 'web-01');
  assert.equal(renderTemplate('{{missing|default:fallback}}', data), 'fallback');
  assert.equal(renderTemplate('{{tags}}', data), 'disk,prod');
});

test('if / else 条件块', () => {
  assert.equal(renderTemplate('{{#if level=="error"}}🔴{{else}}✅{{/if}}', data), '🔴');
  assert.equal(renderTemplate('{{#if level=="info"}}A{{else}}B{{/if}}', data), 'B');
  assert.equal(renderTemplate('{{#if tags contains "disk"}}有标签{{/if}}', data), '有标签');
  assert.equal(renderTemplate('{{#if missing}}no{{/if}}', data), '');
});

test('each 循环', () => {
  assert.equal(renderTemplate('{{#each tags}}[{{this}}]{{/each}}', data), '[disk][prod]');
  assert.equal(renderTemplate('{{#each tags as t}}<{{t}}>{{/each}}', data), '<disk><prod>');
});

test('注释与空值', () => {
  assert.equal(renderTemplate('a{{! 注释 }}b', data), 'ab');
  assert.equal(renderTemplate('', data), '');
  assert.equal(renderTemplate(null, data), '');
});

test('提取变量', () => {
  const vars = extractVars('{{title}} {{data.host}} {{#if level}}x{{/if}} {{a|upper}}');
  assert.deepEqual([...vars].sort(), ['a', 'data', 'title']);
});

test('升级标记（不含 eval）', () => {
  // 确认渲染器不会执行任意表达式（如函数调用）
  assert.equal(renderTemplate('{{title.length()}}', data), ''); // 函数调用被当作路径，取不到值
});