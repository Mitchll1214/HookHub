// HookHub 管理后台主控：登录检查、导航、视图路由、初始化状态
// 依赖：common.js（HookHub）、views/*（HookHubViews，已在 index.html 静态加载）

(function () {
  const H = window.HookHub;
  const Views = {};

  // 视图元信息：导航标题 / 页头 kicker 与说明都集中在这里，
  // 各视图只负责渲染自己的内容区。
  const VIEW_META = {
    overview: { title: '总览' },
    channels: { title: '渠道管理' },
    tokens: { title: '令牌管理' },
    routes: { title: '路由与分发' },
    templates: { title: '模板与映射' },
    settings: { title: '全局设置' },
  };

  // 当前渲染序号：防止快速切换视图时，慢请求的结果覆盖新视图
  let renderSeq = 0;

  // ---------- 主入口 ----------
  async function init() {
    // 登录检查（弹模态输密码）
    try {
      await H.ensureAuth();
    } catch {
      return; // 未登录已跳回首页
    }

    Object.assign(Views, window.HookHubViews || {});
    // 总览视图（内联实现，无需额外脚本）
    Views.overview = { render: (box, ctx) => renderOverview(box, ctx) };

    // 绑定导航
    setupNav();
    setupLogout();

    // 初始化状态探测与首屏渲染并行，避免多等一个请求
    await Promise.all([checkInit(), showView(currentViewName())]);

    // 渲染完成后再绑定 hashchange，避免首屏重复渲染
    window.addEventListener('hashchange', () => showView(currentViewName()));
  }

  function currentViewName() {
    const name = location.hash ? location.hash.slice(1) : 'overview';
    return Views[name] ? name : 'overview';
  }

  // 初始化状态：写入共享 state，供总览/设置视图读取
  async function checkInit() {
    const badge = document.getElementById('initBadge');
    let initialized = false;
    try {
      const data = await H.api('/api/settings');
      initialized = !!(data.settings && data.settings.createdAt);
    } catch { /* 未初始化 / KV 未绑定，按未初始化处理 */ }

    H.state.initialized = initialized;
    if (badge) {
      badge.hidden = initialized;
      badge.title = initialized ? '' : '点击前往全局设置完成初始化';
      if (!initialized) {
        badge.textContent = '';
        badge.appendChild(H.el('span', { class: 'badge-dot' }));
        badge.appendChild(document.createTextNode('未初始化'));
        badge.addEventListener('click', () => navigate('settings'));
      }
    }
    return initialized;
  }

  function setupNav() {
    document.querySelectorAll('#sideNav a[data-view]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(a.dataset.view);
      });
    });
  }

  function setupLogout() {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      H.clearPassword();
      H.toast('已退出登录');
      setTimeout(() => { window.location.href = '/'; }, 300);
    });
  }

  // 导航统一入口：同步 hash 并渲染（点击时不再重复监听）
  function navigate(name) {
    const target = Views[name] ? name : 'overview';
    if (location.hash.slice(1) !== target) {
      location.hash = target; // 触发 hashchange → showView
      return;
    }
    showView(target);
  }

  // ---------- 视图骨架 ----------
  function skeleton() {
    const box = H.el('div', { class: 'skeleton-page', 'aria-hidden': 'true' });
    box.appendChild(H.el('div', { class: 'skeleton skeleton-head' }));
    for (let i = 0; i < 3; i++) box.appendChild(H.el('div', { class: 'skeleton skeleton-row' }));
    box.appendChild(H.el('div', { class: 'skeleton skeleton-block' }));
    return box;
  }

  async function showView(name) {
    const meta = VIEW_META[name];
    const mod = Views[name];
    if (!meta || !mod) { showView('overview'); return; }

    // 激活导航
    document.querySelectorAll('#sideNav a[data-view]').forEach((a) => {
      const on = a.dataset.view === name;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = `${meta.title} · HookHub 管理后台`;

    const main = document.getElementById('mainContent');
    const seq = ++renderSeq;
    const root = H.el('div', { class: 'view-root' });
    main.innerHTML = '';
    main.appendChild(root);
    root.appendChild(skeleton());

    // 视图自行渲染页头 + 内容；切换后滚动到内容起点
    try {
      await mod.render(root, { showView, navigate, name });
    } catch (err) {
      if (seq !== renderSeq) return;
      root.innerHTML = '';
      root.appendChild(H.el('div', { class: 'panel' }, [
        H.el('div', {
          class: 'callout callout-err',
          text: '视图渲染出错：' + ((err && err.message) || err),
        }),
      ]));
      return;
    }
    if (seq !== renderSeq) return; // 已被更新的视图取代

    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 总览视图：系统状态 + 快速统计 + 使用指引
  async function renderOverview(box) {
    box.innerHTML = '';

    // 先取统计（并行），失败不阻塞页面
    let stats = null;
    try {
      const [chData, tokData, rtData] = await Promise.all([
        H.api('/api/channels'),
        H.api('/api/tokens'),
        H.api('/api/routes'),
      ]);
      stats = {
        channels: (chData.channels || []),
        tokens: (tokData.tokens || []),
        routes: (rtData.routes || []),
      };
    } catch { /* 忽略统计失败 */ }

    box.appendChild(H.pageHead({
      kicker: 'Overview',
      title: '总览',
      desc: '按顺序完成：渠道 → 令牌 → 路由（可选）→ 调用。所有配置都在本机浏览器完成，无日志、不统计用量。',
      actions: H.primaryAction('配置渠道', () => navigate('channels'), { iconName: 'channels' }),
    }));

    const initialized = H.state.initialized !== false;
    if (!initialized) {
      const warn = H.el('div', { class: 'callout callout-warn' });
      warn.appendChild(H.el('strong', { text: '系统尚未初始化。' }));
      warn.appendChild(document.createTextNode(' 请先到「全局设置」点击「初始化系统」，写入默认配置与示例路由。'));
      const go = H.el('button', { class: 'btn btn-sm btn-accent', text: '前往初始化', style: 'margin-left:var(--sp-3);' });
      go.addEventListener('click', () => navigate('settings'));
      warn.appendChild(go);
      box.appendChild(warn);
    }

    // 统计卡
    if (stats) {
      const enabledChannels = stats.channels.filter((c) => c.enabled !== false).length;
      const activeTokens = stats.tokens.filter((t) => {
        if (t.enabled === false) return false;
        const exp = t.expiresAt ? new Date(t.expiresAt).getTime() : NaN;
        return Number.isNaN(exp) || exp > Date.now();
      }).length;
      const enabledRoutes = stats.routes.filter((r) => r.enabled !== false).length;

      const grid = H.el('div', { class: 'stat-grid' });
      const card = (label, value, meta, { iconName, view } = {}) => {
        const node = H.el(view ? 'a' : 'div', {
          class: 'stat-card',
          href: view ? '#' + view : null,
          'aria-label': view ? `${label} ${value}，前往${VIEW_META[view].title}` : null,
        });
        const head = H.el('div', { class: 'stat-head' });
        head.appendChild(H.el('span', { class: 'stat-label', text: label }));
        head.appendChild(H.el('span', { class: 'stat-icon', 'aria-hidden': 'true' }, [H.icon(iconName || 'layers', { size: 15 })]));
        node.appendChild(head);
        const val = H.el('div', { class: 'stat-value' });
        val.appendChild(document.createTextNode(String(value)));
        if (meta.total != null && meta.total !== value) {
          val.appendChild(H.el('small', { text: `/${meta.total}` }));
        }
        node.appendChild(val);
        node.appendChild(H.el('div', { class: 'stat-meta', text: meta.text }));
        return node;
      };

      grid.appendChild(card('渠道', enabledChannels, { total: stats.channels.length, text: '启用中 · 推送目标' }, { iconName: 'channels', view: 'channels' }));
      grid.appendChild(card('令牌', activeTokens, { total: stats.tokens.length, text: '可用 · 调用入口' }, { iconName: 'key', view: 'tokens' }));
      grid.appendChild(card('路由', enabledRoutes, { total: stats.routes.length, text: '启用中 · 分发规则' }, { iconName: 'routes', view: 'routes' }));
      box.appendChild(grid);
    }

    // 使用流程
    const guide = H.el('div', { class: 'panel' });
    guide.appendChild(H.el('h2', { class: 'panel-title', text: '使用流程' }));
    guide.appendChild(H.el('p', { class: 'panel-desc', text: '四步即可让一条消息同时送达多个渠道。' }));
    const ol = H.el('ol', { class: 'steps' });
    const steps = [
      ['配置渠道', '在「渠道管理」新增渠道（如 Bark、企业微信），填密钥后点「测试」验证。'],
      ['生成令牌', '在「令牌管理」生成令牌，复制 /hook/令牌 地址作为统一入口。'],
      ['配置路由（可选）', '在「路由与分发」按级别/标签/字段配置条件与降级链；不配则走全局默认兜底。'],
      ['美化格式（可选）', '在「模板与映射」调整标题/正文模板，右侧实时预览。'],
    ];
    for (const [title, desc] of steps) {
      const li = H.el('li');
      li.appendChild(H.el('strong', { text: title }));
      li.appendChild(document.createTextNode(' — ' + desc));
      ol.appendChild(li);
    }
    guide.appendChild(ol);
    box.appendChild(guide);

    // 调用示例
    const sample = H.el('div', { class: 'panel' });
    const sampleHead = H.el('div', { class: 'panel-head' });
    sampleHead.appendChild(H.el('h2', { class: 'panel-title', text: '调用示例' }));
    const sampleDesc = H.el('span', { class: 'panel-desc', text: '一次调用，多渠道并行送达' });
    sampleHead.appendChild(sampleDesc);
    sample.appendChild(sampleHead);
    const code = H.el('pre', {
      style: 'margin:0;',
      text: `curl -X POST https://你的域名/hook/你的令牌 \\
  -H "Content-Type: application/json" \\
  -d '{"title":"磁盘告警","body":"/data 使用率 92%","level":"error","tags":["disk"]}'`,
    });
    sample.appendChild(code);
    box.appendChild(sample);

    // 设计说明
    const note = H.el('div', { class: 'callout' });
    note.appendChild(H.el('strong', { text: '关于日志' }));
    note.appendChild(document.createTextNode(' 本系统为 Free 计划设计，不记录日志、不统计用量。排障请以 webhook 同步返回的 results 数组为准。'));
    box.appendChild(note);
  }

  document.addEventListener('DOMContentLoaded', init);
})();