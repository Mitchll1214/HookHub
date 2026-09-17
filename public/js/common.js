// HookHub 前端共享工具库
// 提供：API 客户端（自动带 X-Admin-Password）、登录态、toast、DOM 工具。

window.HookHub = (() => {
  const PASSWORD_KEY = 'hookhub_admin_password';

  // ---------- Toast ----------
  function ensureToastContainer() {
    let el = document.getElementById('toasts');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toasts';
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
    if (res.status === 401) {
      // 密码失效：清空并提示
      clearPassword();
      throw new ApiError('登录已失效，请重新输入管理员密码', 401, data);
    }
    if (!res.ok) {
      throw new ApiError((data && data.error) || `请求失败 (${res.status})`, res.status, data);
    }
    return data;
  }

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  // ---------- DOM 工具 ----------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
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

  // ---------- 模态 ----------
  function openModal({ title, content, footer, large = false, onClose }) {
    const mask = el('div', { class: 'modal-mask' });
    const modal = el('div', { class: 'modal' + (large ? ' modal-lg' : '') });
    const head = el('div', { class: 'modal-head' });
    head.appendChild(el('h3', { class: 'modal-title', text: title }));
    const closeBtn = el('button', { class: 'close-x', text: '×', title: '关闭' });
    head.appendChild(closeBtn);
    modal.appendChild(head);
    modal.appendChild(content);
    if (footer) modal.appendChild(footer);
    mask.appendChild(modal);
    document.body.appendChild(mask);

    const close = () => {
      mask.remove();
      document.removeEventListener('keydown', onKey);
      if (onClose) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    closeBtn.addEventListener('click', close);
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    document.addEventListener('keydown', onKey);
    return { mask, modal, close };
  }

  // 确认框
  function confirmDialog(message, { danger = false } = {}) {
    return new Promise((resolve) => {
      const content = el('div');
      content.appendChild(el('p', { text: message }));
      const foot = el('div', { class: 'modal-foot' });
      const btnCancel = el('button', { class: 'btn', text: '取消' });
      const btnOk = el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: '确认' });
      foot.appendChild(btnCancel);
      foot.appendChild(btnOk);
      const m = openModal({ title: danger ? '确认删除' : '确认操作', content, footer: foot });
      btnCancel.addEventListener('click', () => { m.close(); resolve(false); });
      btnOk.addEventListener('click', () => { m.close(); resolve(true); });
    });
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
      const btn = el('button', { class: 'btn btn-primary', text: '登录' });
      foot.appendChild(btn);
      const m = openModal({ title, content, footer: foot, onClose: () => resolve(null) });

      const submit = async () => {
        const pwd = input.value.trim();
        if (!pwd) return;
        btn.disabled = true;
        btn.textContent = '校验中…';
        try {
          const data = await api('/api/auth/check', { pwd });
          if (data.ok) {
            setPassword(pwd);
            m.close();
            resolve(pwd);
          } else {
            err.style.display = 'block';
            btn.disabled = false;
            btn.textContent = '登录';
          }
        } catch {
          err.style.display = 'block';
          btn.disabled = false;
          btn.textContent = '登录';
        }
      };
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
    api, ApiError, toast, esc, el, fmtTime,
    openModal, confirmDialog, askPassword, ensureAuth,
    getPassword, setPassword, clearPassword, checkAuth,
    PASSWORD_KEY,
  };
})();