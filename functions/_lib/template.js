// ============================================================
// 自研极简模板渲染引擎 —— 禁止 eval / new Function
//
// 语法（白名单，不支持任意 JS）：
//   {{var}}                         取值，如 {{title}} {{data.host}} {{tags}}
//   {{var|upper}} / {{var|lower}}   大小写转换
//   {{var|default:xxx}}             为空时取默认值
//   {{#if expr}}...{{/if}}          条件块
//   {{#each data.items}} {{this}} {{/each}}
//                                  item 名称默认 this（可写 {{#each data.items as item}}）
//   {{! 注释 }}                      注释
//
// 表达式 expr 支持：==  !=  >  >=  <  <=  &&  ||  !  以及引号字符串
// 例如：{{#if level=="error"}} 🔴 {{else}} ✅ {{/if}}、{{#if tags contains "urgent"}}
// ============================================================

const TOKEN_RE = /\{\{([^{}]+)\}\}/;

function strip(str) {
  return str == null ? '' : String(str);
}

// ---- 表达式求值（白名单运算符，无任意代码）----

function evalExprOps(expr, ctx) {
  // 处理 contains
  const containsMatch = expr.match(/^(.+?)\s+contains\s+(.+)$/);
  if (containsMatch) {
    const arr = resolvePath(containsMatch[1].trim(), ctx);
    const needle = unquoteOrResolve(containsMatch[2].trim(), ctx);
    if (Array.isArray(arr)) return arr.includes(needle);
    return String(arr == null ? '' : arr).includes(needle);
  }
  // 处理 || 
  const orParts = splitTopLevel(expr, '||');
  if (orParts.length > 1) {
    for (const part of orParts) {
      if (truthy(evalExprOps(part.trim(), ctx))) return true;
    }
    return false;
  }
  // 处理 &&
  const andParts = splitTopLevel(expr, '&&');
  if (andParts.length > 1) {
    for (const part of andParts) {
      if (!truthy(evalExprOps(part.trim(), ctx))) return false;
    }
    return true;
  }
  // 一元 !
  if (/^!\s*/.test(expr)) {
    return !truthy(evalExprOps(expr.replace(/^!\s*/, ''), ctx));
  }
  // 比较
  const cmp = expr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (cmp) {
    const lhs = resolvePath(cmp[1].trim(), ctx);
    const rhs = unquoteOrResolve(cmp[3].trim(), ctx);
    const a = strip(lhs);
    const b = strip(rhs);
    switch (cmp[2]) {
      case '==': return a === b;
      case '!=': return a !== b;
      case '>': return Number(a) > Number(b);
      case '>=': return Number(a) >= Number(b);
      case '<': return Number(a) < Number(b);
      case '<=': return Number(a) <= Number(b);
    }
  }
  return truthy(resolvePath(expr.trim(), ctx));
}

function truthy(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v !== '';
  return Boolean(v);
}

function unquoteOrResolve(tok, ctx) {
  const t = tok.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return resolvePath(t, ctx);
}

function splitTopLevel(s, sep) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth === 0 && s.startsWith(sep, i)) {
      out.push(cur);
      cur = '';
      i += sep.length - 1;
      continue;
    }
    cur += ch;
  }
  if (cur !== '' || out.length === 0) out.push(cur);
  return out;
}

function resolvePath(path, ctx) {
  const p = String(path).trim();
  if (p === 'this' || p === '.') return ctx.$this;
  if (p === 'true') return true;
  if (p === 'false') return false;
  if (p === 'null') return null;
  if (p === 'undefined') return undefined;
  const parts = p.split('.');
  let cur = ctx;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function applyFilters(expr, ctx) {
  // 形如：var | upper | default:xxx
  const parts = expr.split('|').map((s) => s.trim());
  let value = resolvePath(parts[0], ctx);
  for (let i = 1; i < parts.length; i++) {
    const f = parts[i];
    if (f === 'upper') value = strip(value).toUpperCase();
    else if (f === 'lower') value = strip(value).toLowerCase();
    else if (f === 'trim') value = strip(value).trim();
    else if (f.startsWith('default:')) {
      if (value == null || value === '') value = f.slice('default:'.length);
    }
    else if (f === 'json') value = JSON.stringify(value);
    else if (f.startsWith('truncate:')) {
      const n = parseInt(f.slice('truncate:'.length), 10);
      value = strip(value).length > n ? strip(value).slice(0, n) + '…' : strip(value);
    }
    // 未知过滤器：忽略
  }
  return value;
}

// ---- 主渲染 ----

/**
 * 渲染模板。
 * @param {string} template 模板文本
 * @param {object} data 渲染上下文（含 title/body/level/… 及 $this 用于 each）
 * @returns {string}
 */
export function renderTemplate(template, data) {
  if (template == null) return '';
  const ctx = { ...data, $this: data };
  return renderBlocks(template, ctx);
}

function renderBlocks(text, ctx) {
  let out = '';
  let rest = text;
  // 逐段扫描，处理 {{ }} 
  while (rest.length) {
    const m = TOKEN_RE.exec(rest);
    if (!m) { out += rest; break; }
    out += rest.slice(0, m.index);
    let inner = m[1].trim();
    const isBlockOpen = inner.startsWith('#');
    const isElse = inner.startsWith('else');
    const isBlockClose = inner.startsWith('/');
    const isComment = inner.startsWith('!');
    if (isBlockOpen || isElse || isBlockClose || isComment) {
      // 块级语法：需要找到对应结束标签
      // 交由块处理器处理
      const rest2 = rest.slice(m.index);
      const handled = renderBlockNode(rest2, ctx, m[0]);
      out += handled.out;
      rest = handled.rest;
    } else {
      out += strip(applyFilters(inner, ctx));
      rest = rest.slice(m.index + m[0].length);
    }
  }
  return out;
}

// 渲染一个块节点（开标签+内容+闭标签），返回 { out, rest }
function renderBlockNode(text, ctx, openTag) {
  const inner = openTag.slice(2, -2).trim();
  const isComment = inner.startsWith('!');

  if (isComment) {
    // {{! ... }}：注释到下一个 }} 结束（不支持多行注释）
    const close = text.indexOf('}}');
    if (close === -1) return { out: '', rest: '' };
    return { out: '', rest: text.slice(close + 2) };
  }

  const isIf = inner.startsWith('#if');
  const isEach = inner.startsWith('#each');

  if (isIf) {
    const expr = inner.slice(3).trim();
    const block = findBlockEnd(text, '#if', '/if');
    if (!block) return { out: text, rest: '' }; // 无闭合：原样输出剩余
    const cond = truthy(evalExprOps(expr, ctx));
    const { bodyText, elseText, rest } = splitIfContent(block.bodyText);
    const rendered = cond ? renderBlocks(bodyText, ctx) : renderBlocks(elseText, ctx);
    // block.bodyText 从 openTag 之后开始
    return { out: rendered, rest: block.rest };
  }

  if (isEach) {
    const m = inner.match(/^#each\s+(.+?)(?:\s+as\s+([\w$]+))?$/);
    if (!m) return { out: text, rest: '' };
    const path = m[1].trim();
    const itemName = m[2] || '$this';
    const arr = resolvePath(path, ctx);
    const block = findBlockEnd(text, '#each', '/each');
    if (!block) return { out: text, rest: '' };
    let out = '';
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const subCtx = { ...ctx, [itemName]: item, $this: item };
        out += renderBlocks(block.bodyText, subCtx);
      }
    }
    return { out, rest: block.rest };
  }

  // 未知块：原样输出
  return { out: text, rest: '' };
}

function findBlockEnd(text, openKind, closeKind) {
  // text 以 {{#if ...}} 开头
  const openTagEnd = text.indexOf('}}');
  if (openTagEnd === -1) return null;
  const bodyStart = openTagEnd + 2;
  // 扫描嵌套
  let depth = 1;
  let i = bodyStart;
  while (i < text.length) {
    const m = TOKEN_RE.exec(text.slice(i));
    if (!m) break;
    const absIndex = i + m.index;
    const inner = m[1].trim();
    if (inner.startsWith('#')) depth++;
    else if (inner.startsWith('/')) depth--;
    if (depth === 0) {
      const bodyText = text.slice(bodyStart, absIndex);
      const rest = text.slice(absIndex + m[0].length);
      return { bodyText, rest };
    }
    i = absIndex + m[0].length;
  }
  return null;
}

// 拆分 if 块内容为 (条件真部分, else 部分)
function splitIfContent(bodyText) {
  const m = bodyText.match(/^(.*?)\{\{\s*else\s*\}\}([\s\S]*)$/);
  if (m) return { bodyText: m[1], elseText: m[2] };
  return { bodyText, elseText: '' };
}

/** 从模板中提取变量名列表（用于前台变量面板提示） */
export function extractVars(template) {
  if (!template) return [];
  const vars = new Set();
  const re = /\{\{([^{}]+)\}\}/g;
  let m;
  while ((m = re.exec(template))) {
    const inner = m[1].trim();
    if (inner.startsWith('#') || inner.startsWith('/') || inner.startsWith('!') || inner.startsWith('else')) continue;
    // 过滤器截断
    const base = inner.split('|')[0].trim();
    // 默认值过滤
    if (base.includes('==') || base.includes('!=') || base.includes('contains')) continue;
    const first = base.split(/[.\s(]/)[0];
    if (first && /^[A-Za-z_$][\w$]*$/.test(first)) vars.add(first);
  }
  return [...vars];
}