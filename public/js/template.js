// 前端模板渲染器 —— 与后端 lib/template.js 语法一致（占位符/条件/循环/过滤器）
// 用于后台实时预览；不执行任意 JS。

window.HookHubTemplate = (() => {
  const TOKEN_RE = /\{\{([^{}]+)\}\}/;

  function strip(v) { return v == null ? '' : String(v); }

  function truthy(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v !== '';
    return Boolean(v);
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

  function unquoteOrResolve(tok, ctx) {
    const t = tok.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return resolvePath(t, ctx);
  }

  function splitTopLevel(s, sep) {
    const out = [];
    let depth = 0, cur = '';
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      if (depth === 0 && s.startsWith(sep, i)) {
        out.push(cur); cur = ''; i += sep.length - 1; continue;
      }
      cur += s[i];
    }
    if (cur !== '' || out.length === 0) out.push(cur);
    return out;
  }

  function evalExpr(expr, ctx) {
    const contains = expr.match(/^(.+?)\s+contains\s+(.+)$/);
    if (contains) {
      const arr = resolvePath(contains[1].trim(), ctx);
      const needle = unquoteOrResolve(contains[2].trim(), ctx);
      if (Array.isArray(arr)) return arr.includes(needle);
      return String(arr == null ? '' : arr).includes(needle);
    }
    const orParts = splitTopLevel(expr, '||');
    if (orParts.length > 1) {
      for (const p of orParts) if (truthy(evalExpr(p.trim(), ctx))) return true;
      return false;
    }
    const andParts = splitTopLevel(expr, '&&');
    if (andParts.length > 1) {
      for (const p of andParts) if (!truthy(evalExpr(p.trim(), ctx))) return false;
      return true;
    }
    if (/^!\s*/.test(expr)) return !truthy(evalExpr(expr.replace(/^!\s*/, ''), ctx));
    const cmp = expr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (cmp) {
      const a = strip(resolvePath(cmp[1].trim(), ctx));
      const b = strip(unquoteOrResolve(cmp[3].trim(), ctx));
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

  function applyFilters(expr, ctx) {
    const parts = expr.split('|').map((s) => s.trim());
    let value = resolvePath(parts[0], ctx);
    for (let i = 1; i < parts.length; i++) {
      const f = parts[i];
      if (f === 'upper') value = strip(value).toUpperCase();
      else if (f === 'lower') value = strip(value).toLowerCase();
      else if (f === 'trim') value = strip(value).trim();
      else if (f.startsWith('default:')) { if (value == null || value === '') value = f.slice(8); }
      else if (f === 'json') value = JSON.stringify(value);
      else if (f.startsWith('truncate:')) {
        const n = parseInt(f.slice(9), 10);
        value = strip(value).length > n ? strip(value).slice(0, n) + '…' : strip(value);
      }
    }
    return value;
  }

  function findBlockEnd(text) {
    const openEnd = text.indexOf('}}');
    if (openEnd === -1) return null;
    const bodyStart = openEnd + 2;
    let depth = 1, i = bodyStart;
    while (i < text.length) {
      const m = TOKEN_RE.exec(text.slice(i));
      if (!m) break;
      const abs = i + m.index;
      const inner = m[1].trim();
      if (inner.startsWith('#')) depth++;
      else if (inner.startsWith('/')) depth--;
      if (depth === 0) {
        return { bodyText: text.slice(bodyStart, abs), rest: text.slice(abs + m[0].length) };
      }
      i = abs + m[0].length;
    }
    return null;
  }

  function renderBlocks(text, ctx) {
    let out = '', rest = text;
    while (rest.length) {
      const m = TOKEN_RE.exec(rest);
      if (!m) { out += rest; break; }
      out += rest.slice(0, m.index);
      const inner = m[1].trim();
      if (inner.startsWith('#') || inner.startsWith('/') || inner.startsWith('!') || inner.startsWith('else')) {
        const r2 = rest.slice(m.index);
        const handled = renderBlockNode(r2, ctx);
        out += handled.out;
        rest = handled.rest;
      } else {
        out += strip(applyFilters(inner, ctx));
        rest = rest.slice(m.index + m[0].length);
      }
    }
    return out;
  }

  function renderBlockNode(text, ctx) {
    const inner0 = text.slice(2).split('}}')[0].trim();
    if (inner0.startsWith('!')) {
      const close = text.indexOf('}}');
      return close === -1 ? { out: '', rest: '' } : { out: '', rest: text.slice(close + 2) };
    }
    if (inner0.startsWith('#if')) {
      const expr = inner0.slice(3).trim();
      const block = findBlockEnd(text);
      if (!block) return { out: text, rest: '' };
      const cond = truthy(evalExpr(expr, ctx));
      const mElse = block.bodyText.match(/^(.*?)\{\{\s*else\s*\}\}([\s\S]*)$/);
      const body = mElse ? (cond ? mElse[1] : mElse[2]) : (cond ? block.bodyText : '');
      return { out: renderBlocks(body, ctx), rest: block.rest };
    }
    if (inner0.startsWith('#each')) {
      const mm = inner0.match(/^#each\s+(.+?)(?:\s+as\s+([\w$]+))?$/);
      if (!mm) return { out: text, rest: '' };
      const arr = resolvePath(mm[1].trim(), ctx);
      const itemName = mm[2] || '$this';
      const block = findBlockEnd(text);
      if (!block) return { out: text, rest: '' };
      let out = '';
      if (Array.isArray(arr)) {
        for (const item of arr) {
          out += renderBlocks(block.bodyText, { ...ctx, [itemName]: item, $this: item });
        }
      }
      return { out, rest: block.rest };
    }
    return { out: text, rest: '' };
  }

  function render(template, data) {
    if (template == null) return '';
    return renderBlocks(String(template), { ...data, $this: data });
  }

  /** 提取变量（用于变量面板） */
  function extractVars(template) {
    if (!template) return [];
    const vars = new Set();
    const re = /\{\{([^{}]+)\}\}/g;
    let m;
    while ((m = re.exec(template))) {
      const inner = m[1].trim();
      if (inner.startsWith('#') || inner.startsWith('/') || inner.startsWith('!') || inner.startsWith('else')) continue;
      const base = inner.split('|')[0].trim();
      if (base.includes('==') || base.includes('!=') || base.includes('contains')) continue;
      const first = base.split(/[.\s(]/)[0];
      if (first && /^[A-Za-z_$][\w$]*$/.test(first)) vars.add(first);
    }
    return [...vars];
  }

  return { render, extractVars };
})();