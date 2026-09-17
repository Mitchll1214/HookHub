// HookHub 管理后台主控：登录检查、导航、视图路由、初始化状态
// 依赖：common.js（HookHub）、views/*（HookHubViews）

(function () {
  const H = window.HookHub;
  const Views = {};

  // ---------- 静态资源加载 ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('加载失败: ' + src));
      document.head.appendChild(s);
    });
  }

  // ---------- 主入口 ----------
  async function init() {
    // 登录检查（弹模态输密码）
    try {
      await H.ensureAuth();
    } catch {
      return; // 未登录已跳回首页
    }

    // 加载视图模块
    const viewSrcs = [
      '/js/views/channels.js',
      '/js/views/tokens.js',
      '/js/views/routes.js',
      '/js/views/templates.js',
      '/js/views/settings.js',
    ];
    for (const src of viewSrcs) await loadScript(src);
    Object.assign(Views, window.HookHubViews || {});

    // 总览视图（内联实现，无需额外脚本）
    Views.overview = { render: (box, ctx) => renderOverview(box, ctx) };

    // 检查系统是否已初始化
    await checkInit();

    // 绑定导航
    setupNav();

    // 渲染默认视图
    showView(location.hash ? location.hash.slice(1) : 'overview');

    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', () => {
      H.clearPassword();
      H.toast('已退出登录');
      setTimeout(() => { window.location.href = '/'; }, 300);
    });
  }

  async function checkInit() {
    const badge = document.getElementById('initBadge');
    try {
      const data = await H.api('/api/settings');
      const s = data.settings;
      if (s && s.createdAt) {
        badge.style.display = 'none';
        window.__hookhubInitialized = true;
        return;
      }
    } catch { /* 未初始化或不支持 */ }
    // 未初始化：显示提示。init 按钮在 settings 视图
    badge.style.display = 'inline-flex';
    badge.textContent = '未初始化 · 请先到全局设置初始化';
    badge.style.cursor = 'pointer';
    badge.title = '点击前往全局设置';
    badge.addEventListener('click', () => { showView('settings'); });
    window.__hookhubInitialized = false;
  }

  function setupNav() {
    const links = document.querySelectorAll('#sideNav a');
    links.forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        showView(a.dataset.view);
      });
    });
    window.addEventListener('hashchange', () => {
      const v = location.hash ? location.hash.slice(1) : 'overview';
      showView(v);
    });
  }

  // 总览视图：系统状态 + 快速统计 + 使用指引
  async function renderOverview(box, ctx) {
    box.innerHTML = '';
    const wrap = H.el('div', { class: 'panel' });
    wrap.appendChild(H.el('h2', { class: 'panel-title', text: '总览' }));
    wrap.appendChild(H.el('p', { class: 'lead', text: 'HookHub 管理后台。按顺序完成：渠道 → 令牌 → 路由（可选）→ 调用。' }));

    const initialized = window.__hookhubInitialized;
    if (!initialized) {
      const warn = H.el('div', { class: 'callout callout-warn' });
      warn.appendChild(H.el('strong', { text: '系统尚未初始化。' }));
      warn.appendChild(document.createTextNode(' 请先到「全局设置」点击「初始化系统」。'));
      wrap.appendChild(warn);
    }

    // 快速统计
    try {
      const [chData, tokData, rtData] = await Promise.all([
        H.api('/api/channels'),
        H.api('/api/tokens'),
        H.api('/api/routes'),
      ]);
      const statRow = H.el('div', {
        style: 'display:flex;gap:var(--sp-4);flex-wrap:wrap;margin:var(--sp-4) 0;',
      });
      const mkStat = (label, count, sub) => {
        const s = H.el('div', { class: 'panel', style: 'padding:var(--sp-3) var(--sp-4);margin:0;min-width:130px;flex:1;' });
        s.appendChild(H.el('div', { text: String(count), style: 'font-size:26px;font-weight:700;color:var(--primary);' }));
        s.appendChild(H.el('div', { class: 'field-hint', text: label }));
        if (sub) s.appendChild(H.el('div', { class: 'field-hint', text: sub }));
        return s;
      };
      statRow.appendChild(mkStat('渠道', (chData.channels || []).length, '推送目标'));
      statRow.appendChild(mkStat('令牌', (tokData.tokens || []).length, '调用入口'));
      statRow.appendChild(mkStat('路由', (rtData.routes || []).length, '分发规则'));
      wrap.appendChild(statRow);
    } catch { /* 忽略统计失败 */ }

    // 使用指引
    const guide = H.el('div', { class: 'callout callout-ok', style: 'margin-top:var(--sp-4);' });
    guide.appendChild(H.el('strong', { text: '使用流程' }));
    const ol = H.el('ol', { class: 'steps', style: 'margin-top:var(--sp-2);' });
    const steps = [
      '渠道管理 → 新增渠道 → 测试发送',
      '令牌管理 → 生成令牌 → 复制 Webhook 地址',
      '路由与分发 →（可选）配置条件与降级链；不配则发到全局默认兜底',
      '模板与映射 →（可选）美化消息格式，含实时预览',
    ];
    for (const s of steps) ol.appendChild(H.el('li', { text: s }));
    guide.appendChild(ol);
    wrap.appendChild(guide);

    // 无日志说明
    const note = H.el('div', { class: 'callout' });
    note.appendChild(H.el('strong', { text: '关于日志' }));
    note.appendChild(document.createTextNode(' 本系统为 Free 计划设计，不记录日志、不统计用量。排障请以 webhook 同步返回的 results 数组为准。'));
    wrap.appendChild(note);

    box.appendChild(wrap);
  }

  function showView(name) {
    // 视图名 → 模块
    const map = {
      overview: Views.overview,
      channels: Views.channels,
      tokens: Views.tokens,
      routes: Views.routes,
      templates: Views.templates,
      settings: Views.settings,
    };
    const mod = map[name];
    if (!mod) { showView('overview'); return; }

    // 激活导航
    document.querySelectorAll('#sideNav a').forEach((a) => {
      a.classList.toggle('active', a.dataset.view === name);
    });
    const main = document.getElementById('mainContent');
    const box = document.createElement('div');
    main.innerHTML = '';
    main.appendChild(box);
    try {
      mod.render(box, { showView });
    } catch (err) {
      box.innerHTML = `<div class="panel"><div class="callout callout-err">视图渲染出错：${H.esc(err && err.message || err)}</div></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();