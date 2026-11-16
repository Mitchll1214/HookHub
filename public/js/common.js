// HookHub 前端共享工具库
// 提供：API 客户端（自动带 X-Admin-Password）、登录态、toast、DOM 工具、
//       图标、页头、表单弹窗、复制、空状态等后台通用组件。

window.HookHub = (() => {
  const PASSWORD_KEY = 'hookhub_admin_password';

  // 跨视图共享的运行时状态（初始化标记等），避免挂 window.__xxx 全局
  const state = { initialized: null };

  // ---------- 图标（内联 SVG，stroke 随 currentColor） ----------
  const ICONS = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    channels: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
    tokens: '<circle cx="7.5" cy="16.5" r="4.5"/><path d="M10.8 13.2 21 3"/><path d="m17 6.8 3.2 3.2"/>',
    routes: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    templates: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    key: '<circle cx="7.5" cy="16.5" r="4.5"/><path d="M10.8 13.2 21 3"/><path d="m17 6.8 3.2 3.2"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a3 3 0 0 0-3 3v6.5A2.5 2.5 0 0 0 5.5 15"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    check: '<path d="m4 12.5 5 5L20 6.5"/>',
    warn: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5"/><path d="M12 17.2h.01"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4Z"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6.5 7l1 13h9l1-13"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  };

  function icon(name, { size = 16, cls = '' } = {}) {
    const span = document.createElement('span');
    span.className = 'icon' + (cls ? ' ' + cls : '');
    span.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = ICONS[name] || ICONS.overview;
    span.appendChild(svg);
    return span;
  }

  // ---------- Toast ----------
  function ensureToastContainer() {
    let el = document.getElementById('toasts');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toasts';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  function toast(msg, type = '') {
    const box = ensureToastContainer();
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity .3s';
      setTimeout(() => t.remove(), 320);
    }, 3200);
  }

  // ---------- 登录态 ----------
  function getPassword() {
    return sessionStorage.getItem(PASSWORD_KEY) || '';
  }
  function setPassword(pwd) {
    sessionStorage.setItem(PASSWORD_KEY, pwd);
  }
  function clearPassword() {
    sessionStorage.removeItem(PASSWORD_KEY);
  }

  async function checkAuth() {
    const pwd = getPassword();
    if (!pwd) return false;
    const res = await fetch('/api/auth/check', { headers: { 'X-Admin-Password': pwd } }).catch(() => null);
    if (res && res.status === 200) {
      const data = await res.json().catch(() => ({}));
      return !!data.ok;
    }
    return false;
  }

  // ---------- API 客户端 ----------
  async function api(path, { method = 'GET', body, pwd } = {}) {
    const password = pwd !== undefined ? pwd : getPassword();
    const headers = {};
    if (password) headers['X-Admin-Password'] = password;
    const opts = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch { /* 非 JSON */ }
    if (!res.ok) {
      // 优先透传服务端真实错误（如「缺少 KV_CONFIG 绑定」），
      // 让前端能区分「密码问题」和「部署/绑定问题」
      const serverMsg = data && data.error ? data.error : '';
      if (res.status === 401) {
        clearPassword();
        throw new ApiError(
          serverMsg || '登录已失效，请重新输入管理员密码',
          401, data
        );
      }
      throw new ApiError(serverMsg || `请求失败 (${res.status})`, res.status, data);
    }
    return data;
  }

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  }

  // ---------- DOM 工具 ----------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    // 允许 H.el('td', null, [...]) 这种只想传子节点的写法
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 时间格式化
  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ---------- 页面级组件 ----------
  // 每个视图顶部的标题区：kicker + 标题 + 说明 + 右侧操作
  function pageHead({ kicker, title, desc, actions } = {}) {
    const head = el('div', { class: 'page-head' });
    const main = el('div', { class: 'page-head-main' });
    if (kicker) main.appendChild(el('p', { class: 'page-kicker', text: kicker }));
    main.appendChild(el('h1', { class: 'page-title', text: title || '' }));
    if (desc) main.appendChild(el('p', { class: 'page-desc', text: desc }));
    head.appendChild(main);
    const list = [].concat(actions || []).filter(Boolean);
    if (list.length) {
      const box = el('div', { class: 'page-actions' });
      for (const a of list) box.appendChild(a);
      head.appendChild(box);
    }
    return head;
  }

  // 主操作按钮（带 + 图标）
  function primaryAction(text, onClick, { iconName = 'plus' } = {}) {
    const btn = el('button', { class: 'btn btn-primary', type: 'button' });
    btn.appendChild(icon(iconName, { size: 15 }));
    btn.appendChild(el('span', { text }));
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  // 空状态：图标 + 标题 + 说明 + 可选操作
  function emptyState({ iconName = 'layers', title, desc, action } = {}) {
    const box = el('div', { class: 'empty' });
    const ico = el('div', { class: 'empty-icon' });
    ico.appendChild(icon(iconName, { size: 22 }));
    box.appendChild(ico);
    if (title) box.appendChild(el('p', { class: 'empty-title', text: title }));
    if (desc) box.appendChild(el('p', { class: 'empty-desc', text: desc }));
    if (action) box.appendChild(action);
    return box;
  }

  // ---------- 复制 ----------
  // 统一复制逻辑：优先 clipboard API，失败回退到输入框选中 + execCommand
  async function copyText(text, fallbackInput) {
    try {
      await navigator.clipboard.writeText(text);
      toast('已复制到剪贴板', 'ok');
      return true;
    } catch { /* 回退 */ }
    if (fallbackInput) {
      try {
        fallbackInput.select();
        const ok = document.execCommand('copy');
        if (ok) { toast('已复制（兼容模式）', 'ok'); return true; }
      } catch { /* 继续报错 */ }
    }
    toast('复制失败，请手动选中文本复制', 'err');
    return false;
  }

  // ---------- 模态 ----------
  function openModal({ title, content, footer, large = false, onClose }) {
    const mask = el('div', { class: 'modal-mask' });
    const modal = el('div', {
      class: 'modal' + (large ? ' modal-lg' : ''),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title || '对话框',
    });
    const head = el('div', { class: 'modal-head' });
    head.appendChild(el('h3', { class: 'modal-title', text: title }));
    const closeBtn = el('button', { class: 'close-x', text: '×', title: '关闭', type: 'button', 'aria-label': '关闭' });
    head.appendChild(closeBtn);
    modal.appendChild(head);
    modal.appendChild(content);
    if (footer) modal.appendChild(footer);
    mask.appendChild(modal);

    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(mask);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      mask.remove();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
      if (onClose) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    closeBtn.addEventListener('click', close);
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    document.addEventListener('keydown', onKey);
    return { mask, modal, close };
  }

  // 确认框（Esc / 点遮罩关闭都返回 false，避免 Promise 悬空）
  function confirmDialog(message, { danger = false } = {}) {
    return new Promise((resolve) => {
      const content = el('div');
      content.appendChild(el('p', { text: message, style: 'margin:0;' }));
      const foot = el('div', { class: 'modal-foot' });
      const btnCancel = el('button', { class: 'btn', text: '取消', type: 'button' });
      const btnOk = el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: '确认', type: 'button' });
      foot.appendChild(btnCancel);
      foot.appendChild(btnOk);
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const m = openModal({
        title: danger ? '确认删除' : '确认操作',
        content,
        footer: foot,
        onClose: () => finish(false),
      });
      btnCancel.addEventListener('click', () => { finish(false); m.close(); });
      btnOk.addEventListener('click', () => { finish(true); m.close(); });
    });
  }

  // 表单弹窗：统一的取消/提交、忙碌态、Enter 提交与错误提示
  // onSubmit 返回 false 表示「留在弹窗」（如校验未通过）；抛错则 toast 提示
  function formModal({ title, content, submitText = '保存', onSubmit, large = false }) {
    const foot = el('div', { class: 'modal-foot' });
    const cancel = el('button', { class: 'btn', text: '取消', type: 'button' });
    const save = el('button', { class: 'btn btn-primary', text: submitText, type: 'button' });
    foot.appendChild(cancel);
    foot.appendChild(save);
    const m = openModal({ title, content, footer: foot, large });
    cancel.addEventListener('click', m.close);

    save.addEventListener('click', async () => {
      if (save.disabled) return;
      save.disabled = true;
      const label = save.textContent;
      save.textContent = '处理中…';
      try {
        const keep = await onSubmit();
        if (keep !== false) m.close();
      } catch (e) {
        toast((e && e.message) || '操作失败', 'err');
      } finally {
        save.disabled = false;
        save.textContent = label;
      }
    });

    // Enter 提交（文本域内保留换行）
    content.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (e.target && e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      save.click();
    });
    return { ...m, saveBtn: save, cancelBtn: cancel };
  }

  // ---------- 顶层登录模态（无密码时弹出） ----------
  function askPassword({ title = '管理员登录' } = {}) {
    return new Promise((resolve) => {
      const content = el('div');
      content.appendChild(el('p', {
        class: 'lead', text: '请输入管理员密码（由部署者在 Cloudflare 环境变量中配置）',
        style: 'font-size:14px;margin-bottom:12px;',
      }));
      const input = el('input', { type: 'password', placeholder: 'ADMIN_PASSWORD', style: 'font-family:var(--mono)' });
      const err = el('div', { class: 'field-hint', style: 'color:var(--err);display:none;', text: '密码错误' });
      content.appendChild(input);
      content.appendChild(err);
      const foot = el('div', { class: 'modal-foot' });
      const btn = el('button', { class: 'btn btn-primary', text: '登录', type: 'button' });
      foot.appendChild(btn);

      // 登录是否已成功：成功后 m.close() 会触发 onClose，需避免把结果覆盖成 null
      let resolved = false;
      const m = openModal({
        title, content, footer: foot,
        onClose: () => {
          if (!resolved) resolve(null); // 仅「用户主动关闭」视为取消
        },
      });

      const submit = async () => {
        const pwd = input.value.trim();
        if (!pwd) return;
        btn.disabled = true;
        btn.textContent = '校验中…';
        try {
          const data = await api('/api/auth/check', { pwd });
          if (data.ok) {
            resolved = true;      // 先标记成功，避免 onClose 覆盖
            setPassword(pwd);
            m.close();
            resolve(pwd);
          } else {
            // 后端不支持 ok=false + 200，一般不会走到这里；防御处理
            showLoginError(err, '密码校验未通过');
            btn.disabled = false;
            btn.textContent = '登录';
          }
        } catch (e) {
          const msg = (e && e.message) || '登录失败';
          // 区分「密码不对」与「KV 绑定未生效」两类问题
          if (msg.includes('KV_CONFIG') || msg.includes('KV')) {
            showLoginError(err,
              '⚠️ ' + msg + '\n\n请确认：① 已在 Pages 控制台绑定 KV（变量名 KV_CONFIG）；② 绑定后已重新部署（Retry deployment）。绑定不生效时无法登录，这是部署问题，不是密码问题。');
          } else {
            showLoginError(err, msg);
          }
          btn.disabled = false;
          btn.textContent = '登录';
        }
      };
      function showLoginError(errEl, text) {
        errEl.textContent = text;
        errEl.style.display = 'block';
        errEl.style.whiteSpace = 'pre-line';
      }
      btn.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      setTimeout(() => input.focus(), 30);
    });
  }

  // 保证登录：后台页面加载时调用
  async function ensureAuth() {
    const ok = await checkAuth();
    if (ok) return getPassword();
    const pwd = await askPassword();
    if (!pwd) {
      // 用户关闭了模态：跳回首页
      window.location.href = '/';
      throw new Error('未登录');
    }
    return pwd;
  }

  // ---------- 导出 ----------
  return {
    api, ApiError, toast, esc, el, fmtTime, icon,
    pageHead, primaryAction, emptyState, copyText,
    openModal, confirmDialog, formModal, askPassword, ensureAuth,
    getPassword, setPassword, clearPassword, checkAuth,
    PASSWORD_KEY, state,
  };
})();