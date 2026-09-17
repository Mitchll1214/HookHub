// 入口完整性：所有非 _ 前缀的 Functions 文件必须能成功 import（依赖图完整）
// 且导出 onRequest / onRequestGet / onRequestPost / onRequestPut / onRequestDelete 之一。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const funcsRoot = join(__dirname, '..', 'functions');
const HANDLERS = ['onRequest', 'onRequestGet', 'onRequestPost', 'onRequestPut', 'onRequestDelete'];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name.startsWith('_')) continue; // 任何层级的 _ 前缀（_lib/ _adapters/ _lib.js）都不生成路由
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

test('每个路由文件都可 import 且导出至少一个 handler', async () => {
  const files = walk(funcsRoot);
  assert.ok(files.length >= 10, '应至少有 10 个路由文件');
  for (const f of files) {
    const src = readFileSync(f, 'utf-8');
    const hasExport = HANDLERS.some((h) => new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${h}`).test(src));
    assert.ok(hasExport, `${f} 缺少 onRequest* 导出`);
    // 动态 import 验证依赖图可解析（静态 import 在这里会被真正解析）
    const mod = await import(pathToFileURL(f).href);
    const hasHandler = HANDLERS.some((h) => typeof mod[h] === 'function');
    assert.ok(hasHandler, `${f} 运行时不导出 handler`);
  }
});

test('_lib 与 _adapters 目录存在且非空', () => {
  assert.ok(existsSync(join(funcsRoot, '_lib')), '缺少 functions/_lib');
  assert.ok(existsSync(join(funcsRoot, '_adapters')), '缺少 functions/_adapters');
  assert.ok(readdirSync(join(funcsRoot, '_lib')).length > 5);
  assert.ok(readdirSync(join(funcsRoot, '_adapters')).length > 10);
});