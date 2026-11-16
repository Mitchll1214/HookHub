// 模板与映射视图：可视化变量面板、简单/模板双模式、实时预览、级别映射、字段映射
// 依赖：common.js（HookHub）、template.js（HookHubTemplate）

(function () {
  const H = window.HookHub;
  const T = window.HookHubTemplate;

  const LEVELS = ['info', 'success', 'warning', 'error'];
  // 示例数据（实时预览用）
  const SAMPLE = {
    title: '磁盘使用率告警',
    body: '主机 web-01 的 /data 分区使用率已达 92%，请及时清理。\n\n- 挂载点: /data\n- 已用: 1.8TB\n- 总量: 2TB',
    level: 'error',
    channel: 'bark',
    targets: ['group:oncall'],
    tags: ['disk', 'prod'],
    url: 'https://example.com/ops/disk',
    data: {
      host: 'web-01',
      ip: '10.0.0.8',
      usage: 92,
      items: [
        { name: 'nginx', status: 'up' },
        { name: 'redis', status: 'down' },
      ],
    },
  };

  // 所有可用变量（含 data 展开）
  const VARS = [
    { path: 'title', desc: '标题' },
    { path: 'body', desc: '正文' },
    { path: 'level', desc: '级别 info/success/warning/error' },
    { path: 'channel', desc: '渠道字段' },
    { path: 'url', desc: '链接' },
    { path: 'tags', desc: '标签数组' },
    { path: 'data.host', desc: '自定义数据（示例）' },
    { path: 'data.ip', desc: '自定义数据（示例）' },
    { path: 'data.usage', desc: '自定义数据（示例）' },
  ];

  function insertAtCursor(input, text) {
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + text.length;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 变量 chip 组：点击插入到目标输入框光标处
  function chipRow(target, vars, { label = '点击插入' } = {}) {
    const wrap = H.el('div', { class: 'chip-row', style: 'margin-top:8px;align-items:center;' });
    wrap.appendChild(H.el('span', { class: 'field-hint', style: 'margin:0;', text: label }));
    for (const v of vars) {
      const c = H.el('button', {
        class: 'var-chip', type: 'button', text: `{{${v.path}}}`, title: v.desc,
      });
      c.addEventListener('click', () => insertAtCursor(target, `{{${v.path}}}`));
      wrap.appendChild(c);
    }
    return wrap;
  }

  // 简单模式编辑器：标题格式 / 正文格式 + 占位符快捷插入
  function simpleEditor(bind) {
    const box = H.el('div');

    const pTitle = H.el('div', { class: 'field' });
    pTitle.appendChild(H.el('label', { text: '标题格式' }));
    const tInput = H.el('input', { type: 'text', value: bind.title || '{{title}}' });
    pTitle.appendChild(tInput);
    pTitle.appendChild(chipRow(tInput, VARS.slice(0, 5)));
    box.appendChild(pTitle);

    const pBody = H.el('div', { class: 'field' });
    pBody.appendChild(H.el('label', { text: '正文格式' }));
    const tBody = H.el('textarea', { class: 'mono', style: 'min-height:150px;', text: bind.body || '{{body}}' });
    pBody.appendChild(tBody);
    pBody.appendChild(chipRow(tBody, VARS));
    box.appendChild(pBody);

    return {
      box,
      getValue: () => ({ title: tInput.value, body: tBody.value }),
    };
  }

  // 模板模式编辑器：大文本框 + 变量面板 + 语法提示
  function tplEditor(bind) {
    const box = H.el('div');
    box.appendChild(H.el('p', {
      class: 'field-hint', style: 'margin:0 0 var(--sp-2);',
      text: '支持 {{title}}、{{data.xxx}}、{{a|upper}}、{{a|default:x}}、{{#if level=="error"}}…{{else}}…{{/if}}、{{#each tags}}…{{/each}}。',
    }));

    const lab = H.el('label', { text: '模板内容' });
    box.appendChild(lab);
    const ta = H.el('textarea', {
      class: 'mono', style: 'min-height:280px;',
      text: bind.body || '{{#if level=="error"}}【紧急】{{else}}【通知】{{/if}} {{title}}\n\n{{body}}\n\n{{#each tags}} #{{this}}{{/each}}\n{{#if data.host}}主机: {{data.host}}{{/if}}',
    });
    box.appendChild(ta);
    box.appendChild(chipRow(ta, VARS, { label: '变量' }));

    // 常用模板片段
    const snippets = [
      ['error 强调', '{{#if level=="error"}}🚨 {{else}}✅ {{/if}}{{title}}'],
      ['标签循环', '{{#each tags}}#{{this}} {{/each}}'],
      ['字段兜底', '{{data.host|default:未知主机}}'],
    ];
    const snWrap = H.el('div', { class: 'chip-row', style: 'margin-top:8px;align-items:center;' });
    snWrap.appendChild(H.el('span', { class: 'field-hint', style: 'margin:0;', text: '片段' }));
    for (const [name, sn] of snippets) {
      const b = H.el('button', { class: 'btn btn-sm', type: 'button', text: name });
      b.addEventListener('click', () => insertAtCursor(ta, sn));
      snWrap.appendChild(b);
    }
    box.appendChild(snWrap);

    return {
      box,
      getValue: () => ({ body: ta.value }),
    };
  }

  // 实时预览：三种视图切换
  function previewBox() {
    const box = H.el('div', { class: 'field span-2' });
    const head = H.el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);flex-wrap:wrap;',
    });
    head.appendChild(H.el('label', { text: '实时预览（模拟数据）', style: 'margin:0;' }));
    const tabs = H.el('div', { class: 'preview-tabs', style: 'margin:0;' });
    head.appendChild(tabs);
    box.appendChild(head);

    const pre = H.el('div', { class: 'preview-box', 'data-mode': 'plain' });
    box.appendChild(pre);

    const views = [
      { id: 'md', label: 'Markdown' },
      { id: 'html', label: 'HTML' },
      { id: 'plain', label: '纯文本' },
    ];
    let active = 'md';
    let lastContent = '';

    // HTML 视图展示源码而非执行：模板内容可能来自导入的配置文件，
    // 直接 innerHTML 会把 <script>/onerror 之类注入到后台页面。
    function renderCurrent() {
      pre.textContent = lastContent;
      pre.dataset.mode = active;
    }

    for (const v of views) {
      const b = H.el('button', { type: 'button', text: v.label, class: active === v.id ? 'active' : '' });
      b.addEventListener('click', () => {
        active = v.id;
        tabs.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        renderCurrent();
      });
      tabs.appendChild(b);
    }

    return {
      box,
      render(content) {
        lastContent = content;
        renderCurrent();
      },
    };
  }

  async function renderTemplates(box) {
    currentBox = box;
    box.innerHTML = '';
    const [meta, chData] = await Promise.all([
      H.api('/api/meta'),
      H.api('/api/channels').catch(() => ({ channels: [] })),
    ]);
    const adapterMeta = meta.adapters || [];
    const channels = chData.channels || [];

    box.appendChild(H.pageHead({
      kicker: 'Templates',
      title: '模板与映射',
      desc: '设计消息最终的样子：标题 / 正文格式、按级别映射渠道参数、超长自动裁剪。模板保存在渠道上，此处编辑并实时预览。',
    }));

    if (!channels.length) {
      box.appendChild(H.emptyState({
        iconName: 'templates',
        title: '还没有可编辑的渠道',
        desc: '模板是按渠道保存的。先到「渠道管理」添加一个渠道，再回来调整它的消息格式。',
        action: H.primaryAction('前往渠道管理', () => { location.hash = 'channels'; }, { iconName: 'channels' }),
      }));
      return;
    }

    // ---- 渠道选择 ----
    const selPanel = H.el('div', { class: 'panel' });
    const selField = H.el('div', { class: 'field', style: 'margin:0;' });
    selField.appendChild(H.el('label', { text: '选择要编辑的渠道' }));
    const sel = H.el('select');
    sel.appendChild(H.el('option', { value: '', text: '（选择渠道）' }));
    for (const ch of channels) {
      sel.appendChild(H.el('option', { value: ch.id, text: `${ch.name || ch.type} · ${ch.type}` }));
    }
    selField.appendChild(sel);
    selPanel.appendChild(selField);
    box.appendChild(selPanel);

    const editorBox = H.el('div');
    box.appendChild(editorBox);

    sel.addEventListener('change', () => {
      if (!sel.value) { editorBox.innerHTML = ''; return; }
      loadChannelDetail(sel.value, editorBox, adapterMeta);
    });

    // 默认展开第一个启用渠道（没有则第一个），省一步点击
    const firstCh = channels.find((c) => c.enabled !== false) || channels[0];
    sel.value = firstCh.id;
    loadChannelDetail(firstCh.id, editorBox, adapterMeta);
  }

  async function loadChannelDetail(chId, box, adapterMeta) {
    box.innerHTML = '';
    const { channel } = await H.api(`/api/channels/${chId}`);
    const meta = adapterMeta.find((a) => a.id === channel.type) || { name: channel.type, fields: [] };
    const maxLen = meta.maxLength || 4096;
    const tpl = channel.template || { title: '{{title}}', body: '{{body}}' };

    // ---- 工具栏：模式切换 + 保存 ----
    const panel = H.el('div', { class: 'panel' });
    const bar = H.el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);flex-wrap:wrap;margin-bottom:var(--sp-4);',
    });
    const titleBox = H.el('div', { style: 'min-width:0;' });
    titleBox.appendChild(H.el('h2', {
      class: 'panel-title', text: channel.name || channel.type,
    }));
    titleBox.appendChild(H.el('p', {
      class: 'panel-desc',
      text: `渠道类型 ${meta.name || channel.type} · 单条上限 ${maxLen} 字符`,
    }));
    bar.appendChild(titleBox);

    const modeBox = H.el('div', { style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;' });
    const btnSimple = H.el('button', { class: 'btn btn-sm btn-primary', type: 'button', text: '简单模式' });
    const btnTpl = H.el('button', { class: 'btn btn-sm', type: 'button', text: '模板模式' });
    const saveBtn = H.el('button', { class: 'btn btn-sm btn-accent', type: 'button', text: '保存到渠道' });
    modeBox.appendChild(btnSimple);
    modeBox.appendChild(btnTpl);
    modeBox.appendChild(saveBtn);
    bar.appendChild(modeBox);
    panel.appendChild(bar);

    // ---- 编辑区（模式切换时重建） ----
    const bodyBox = H.el('div');
    panel.appendChild(bodyBox);

    let mode = 'simple';
    let editor = null;
    let preview = null;
    let lenEl = null;
    let levelInputs = {};

    function refreshPreview() {
      if (!editor) return;
      const val = editor.getValue();
      const renderedTitle = T.render(val.title !== undefined ? val.title : tpl.title, SAMPLE);
      const renderedBody = T.render(val.body || (mode === 'simple' ? '{{body}}' : ''), SAMPLE);
      const content = renderedTitle + (renderedBody ? '\n\n' + renderedBody : '');
      preview.render(content);
      const len = content.length;
      if (lenEl) {
        lenEl.textContent = `${len} / ${maxLen} 字符`;
        lenEl.className = 'len-row' + (len > maxLen ? ' len-over' : '');
      }
    }

    function buildEditor() {
      bodyBox.innerHTML = '';
      const grid = H.el('div', { class: 'form-grid' });
      const e = mode === 'simple'
        ? simpleEditor({ title: tpl.title, body: tpl.body })
        : tplEditor({ body: tpl.body });
      editor = e;
      grid.appendChild(e.box);

      preview = previewBox();
      grid.appendChild(preview.box);
      bodyBox.appendChild(grid);

      lenEl = H.el('div', { class: 'len-row' });
      bodyBox.appendChild(lenEl);

      // ---- 级别映射 ----
      const lvSection = H.el('div', { class: 'form-section' });
      lvSection.appendChild(H.el('h4', { text: '级别映射（保存到渠道）' }));
      const defMap = meta.defaultLevelMap || {};
      lvSection.appendChild(H.el('p', {
        class: 'field-hint',
        text: `按消息级别覆盖渠道参数，留空使用默认值（${JSON.stringify(defMap)}）。`,
      }));
      const lvGrid = H.el('div', { class: 'form-grid', style: 'grid-template-columns:repeat(4,1fr);' });
      levelInputs = {};
      for (const lv of LEVELS) {
        const wrap = H.el('div', { class: 'field', style: 'margin:0;' });
        wrap.appendChild(H.el('label', { text: lv }));
        const inp = H.el('input', {
          type: 'text', class: 'mono',
          placeholder: defMap[lv] != null ? String(defMap[lv]) : '（默认）',
          value: (channel.levelMap && channel.levelMap[lv] != null) ? String(channel.levelMap[lv]) : '',
        });
        levelInputs[lv] = inp;
        wrap.appendChild(inp);
        lvGrid.appendChild(wrap);
      }
      lvSection.appendChild(lvGrid);
      bodyBox.appendChild(lvSection);

      refreshPreview();
    }

    // 输入即刷新预览：只在容器上绑定一次（buildEditor 会重复调用，不能放在里面）
    bodyBox.addEventListener('input', () => refreshPreview());

    function setMode(next) {
      if (mode === next) return;
      mode = next;
      btnSimple.className = 'btn btn-sm' + (mode === 'simple' ? ' btn-primary' : '');
      btnTpl.className = 'btn btn-sm' + (mode === 'tpl' ? ' btn-primary' : '');
      buildEditor();
    }

    btnSimple.addEventListener('click', () => setMode('simple'));
    btnTpl.addEventListener('click', () => setMode('tpl'));

    saveBtn.addEventListener('click', async () => {
      if (!editor || saveBtn.disabled) return;
      const val = editor.getValue();
      const levelMap = {};
      for (const lv of LEVELS) {
        const inp = levelInputs[lv];
        if (inp && inp.value.trim() !== '') levelMap[lv] = inp.value.trim();
      }
      saveBtn.disabled = true;
      const label = saveBtn.textContent;
      saveBtn.textContent = '保存中…';
      try {
        await H.api(`/api/channels/${chId}`, {
          method: 'PUT',
          body: {
            template: {
              title: val.title !== undefined ? val.title : tpl.title,
              body: val.body !== undefined ? val.body : tpl.body,
            },
            levelMap,
          },
        });
        H.toast('模板已保存', 'ok');
      } catch (e) {
        H.toast(e.message, 'err');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
      }
    });

    box.appendChild(panel);
    buildEditor();
  }

  window.HookHubViews = window.HookHubViews || {};
  window.HookHubViews.templates = { render: (box) => renderTemplates(box) };
})();