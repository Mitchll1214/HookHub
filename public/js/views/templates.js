// 模板与映射视图：可视化变量面板、简单/模板双模式、实时预览、级别映射、字段映射
// 依赖：common.js（HookHub）、template.js（HookHubTemplate）

(function () {
  const H = window.HookHub;
  const T = window.HookHubTemplate;
  let currentBox = null;

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
  function varList() {
    const base = [
      { path: 'title', desc: '标题' },
      { path: 'body', desc: '正文' },
      { path: 'level', desc: '级别 info/success/warning/error' },
      { path: 'channel', desc: '渠道字段' },
      { path: 'url', desc: '链接' },
      { path: 'tags', desc: '标签数组' },
    ];
    const dataVars = [
      { path: 'data.host', desc: '自定义数据（示例）' },
      { path: 'data.ip', desc: '自定义数据（示例）' },
      { path: 'data.usage', desc: '自定义数据（示例）' },
    ];
    return [...base, ...dataVars];
  }

  // 简单模式编辑器：标题格式 / 正文格式 + 占位符下拉
  function simpleEditor(bind) {
    const box = H.el('div');

    const pTitle = H.el('div', { class: 'field' });
    pTitle.appendChild(H.el('label', { text: '标题格式' }));
    const tInput = H.el('input', { type: 'text', id: 'tpl-simple-title', value: bind.title || '{{title}}' });
    pTitle.appendChild(tInput);
    // 占位符快捷插入
    const chips = H.el('div', { class: 'field-hint', style: 'margin-top:6px;' });
    chips.appendChild(H.el('span', { text: '点击插入: ' }));
    for (const v of varList().slice(0, 5)) {
      const c = H.el('span', { class: 'var-chip', text: `{{${v.path}}}` });
      c.addEventListener('click', () => insertAtCursor(tInput, `{{${v.path}}}`));
      chips.appendChild(c);
    }
    pTitle.appendChild(chips);
    box.appendChild(pTitle);

    const pBody = H.el('div', { class: 'field' });
    pBody.appendChild(H.el('label', { text: '正文格式' }));
    const tBody = H.el('textarea', { id: 'tpl-simple-body', class: 'mono', style: 'min-height:140px;', text: bind.body || '{{body}}' });
    pBody.appendChild(tBody);
    const chips2 = H.el('div', { class: 'field-hint', style: 'margin-top:6px;' });
    chips2.appendChild(H.el('span', { text: '点击插入: ' }));
    for (const v of varList()) {
      const c = H.el('span', { class: 'var-chip', text: `{{${v.path}}}` });
      c.addEventListener('click', () => insertAtCursor(tBody, `{{${v.path}}}`));
      chips2.appendChild(c);
    }
    pBody.appendChild(chips2);
    box.appendChild(pBody);

    return {
      box,
      getValue: () => ({
        title: tInput.value,
        body: tBody.value,
      }),
    };
  }

  // 模板模式编辑器：大文本框 + 变量面板 + 语法提示
  function tplEditor(bind) {
    const box = H.el('div');
    box.appendChild(H.el('p', {
      class: 'field-hint', style: 'margin-bottom:var(--sp-2);',
      text: '支持 {{title}}、{{data.xxx}}、{{a|upper}}、{{a|default:x}}、{{#if level=="error"}}…{{else}}…{{/if}}、{{#each tags}}…{{/each}}。',
    }));

    // 变量面板
    const varPanel = H.el('div', { style: 'margin-bottom:var(--sp-3);' });
    varPanel.appendChild(H.el('div', { class: 'field-hint', style: 'margin-bottom:4px;font-weight:600;', text: '变量面板（点击插入到光标处）' }));
    const chipsWrap = H.el('div');
    for (const v of varList()) {
      const c = H.el('span', {
        class: 'var-chip', text: `{{${v.path}}}`,
        title: v.desc,
      });
      c.addEventListener('click', () => insertAtCursor(ta, `{{${v.path}}}`));
      chipsWrap.appendChild(c);
    }
    varPanel.appendChild(chipsWrap);
    box.appendChild(varPanel);

    const lab = H.el('label', { text: '模板内容' });
    box.appendChild(lab);
    const ta = H.el('textarea', {
      id: 'tpl-advanced-body', class: 'mono', style: 'min-height:260px;',
      text: bind.body || '{{#if level=="error"}}【紧急】{{else}}【通知】{{/if}} {{title}}\n\n{{body}}\n\n{{#each tags}} #{{this}}{{/each}}\n{{#if data.host}}主机: {{data.host}}{{/if}}',
    });
    box.appendChild(ta);

    // 常用模板片段
    box.appendChild(H.el('div', { class: 'field-hint', style: 'margin-top:6px;', text: '常用片段: ' }));
    const snippets = [
      ['error 强调', '{{#if level=="error"}}🚨 {{else}}✅ {{/if}}{{title}}'],
      ['标签循环', '{{#each tags}}#{{this}} {{/each}}'],
    ];
    const snWrap = H.el('div', { style: 'margin-top:4px;' });
    for (const [name, sn] of snippets) {
      const b = H.el('button', { class: 'btn btn-sm', style: 'margin-right:6px;', text: name });
      b.addEventListener('click', () => insertAtCursor(ta, sn));
      snWrap.appendChild(b);
    }
    box.appendChild(snWrap);

    return {
      box,
      getValue: () => ({ body: ta.value }),
    };
  }

  function insertAtCursor(input, text) {
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + text.length;
  }

  // 实时预览
  function previewBox() {
    const box = H.el('div', { class: 'field span-2' });
    box.appendChild(H.el('label', { text: '实时预览（模拟数据）' }));
    const tabs = H.el('div', { class: 'preview-tabs' });
    const views = [
      { id: 'md', label: 'Markdown' },
      { id: 'html', label: 'HTML' },
      { id: 'plain', label: '纯文本' },
    ];
    const pre = H.el('div', { class: 'preview-box', 'data-mode': 'md' });
    tabs.appendChild(H.el('div', { style: 'flex:1;' }));
    box.appendChild(tabs);
    box.appendChild(pre);

    let active = 'md';
    let lastContent = '';
    function renderCurrent() {
      if (!lastContent) { pre.textContent = ''; return; }
      if (active === 'plain') pre.textContent = lastContent;
      else if (active === 'html') pre.innerHTML = lastContent;
      else pre.textContent = lastContent; // markdown 暂按纯文本展示
    }
    for (const v of views) {
      const b = H.el('button', { text: v.label, class: active === v.id ? 'active' : '' });
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

  // 渠道选择（预览时按渠道类型应用模板与长度限制）
  async function loadChannelOptions() {
    try {
      const data = await H.api('/api/channels');
      return data.channels || [];
    } catch { return []; }
  }

  async function renderTemplates(box) {
    currentBox = box;
    box.innerHTML = '';
    const meta = await H.api('/api/meta');
    const channels = await loadChannelOptions();
    const adapterMeta = meta.adapters || [];

    // ---- 说明 ----
    const intro = H.el('div', { class: 'panel' });
    intro.appendChild(H.el('h2', { class: 'panel-title', text: '模板与映射' }));
    intro.appendChild(H.el('p', {
      class: 'panel-desc',
      text: '在这里设计消息最终的样子：标题/正文格式、按级别映射渠道参数、内容超长自动裁剪。模板保存在每个渠道上，这里用于编辑与预览。',
    }));
    box.appendChild(intro);

    // 渠道选择（决定当前编辑哪个渠道的模板）
    const selPanel = H.el('div', { class: 'panel' });
    const selRow = H.el('div', { class: 'field' });
    selRow.appendChild(H.el('label', { text: '选择要编辑的渠道' }));
    const sel = H.el('select', { id: 'tpl-channel-select' });
    sel.appendChild(H.el('option', { value: '', text: '（选择渠道）' }));
    for (const ch of channels) {
      const o = H.el('option', { value: ch.id, text: `${ch.name || ch.type}` });
      sel.appendChild(o);
    }
    selRow.appendChild(sel);
    if (!channels.length) {
      selRow.appendChild(H.el('div', { class: 'field-hint', text: '还没有渠道，先在「渠道管理」添加。' }));
    }
    selPanel.appendChild(selRow);
    box.appendChild(selPanel);

    // 编辑器区（选择渠道后显示）
    const editorBox = H.el('div');
    box.appendChild(editorBox);

    sel.addEventListener('change', () => {
      const chId = sel.value;
      if (!chId) { editorBox.innerHTML = ''; return; }
      loadChannelDetail(chId, editorBox, adapterMeta, channels);
    });

    if (channels.length === 1) {
      // 只有一个渠道直接选中
      sel.value = channels[0].id;
      loadChannelDetail(channels[0].id, editorBox, adapterMeta, channels);
    }
  }

  async function loadChannelDetail(chId, box, adapterMeta, channels) {
    box.innerHTML = '';
    const { channel } = await H.api(`/api/channels/${chId}`);
    const meta = adapterMeta.find((a) => a.id === channel.type);
    const maxLen = (meta && meta.maxLength) || 4096;
    const tpl = channel.template || { title: '{{title}}', body: '{{body}}' };

    // 模式切换
    const modeRow = H.el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3);' });
    modeRow.appendChild(H.el('h3', { class: 'panel-title', text: `编辑渠道「${channel.name || channel.type}」的消息模板`, style: 'font-size:var(--fs-l);' }));
    const modeBox = H.el('div', { style: 'display:flex;gap:6px;align-items:center;' });
    modeBox.appendChild(H.el('span', { class: 'field-hint', text: '模式: ' }));
    const btnSimple = H.el('button', { class: 'btn btn-sm btn-primary', text: '简单模式' });
    const btnTpl = H.el('button', { class: 'btn btn-sm', text: '模板模式' });
    modeBox.appendChild(btnSimple);
    modeBox.appendChild(btnTpl);
    modeRow.appendChild(modeBox);
    box.appendChild(modeRow);

    // 编辑器容器
    const editorWrap = H.el('div', { class: 'panel' });
    editorWrap.appendChild(H.el('div', { class: 'form-grid' }));
    box.appendChild(editorWrap);

    let mode = 'simple';
    let editor = null;

    function buildEditor() {
      editorWrap.innerHTML = '';
      const grid = H.el('div', { class: 'form-grid' });
      if (mode === 'simple') {
        const e = simpleEditor({ title: tpl.title, body: tpl.body });
        editor = e;
        grid.appendChild(e.box);
      } else {
        const e = tplEditor({ body: tpl.body });
        editor = e;
        grid.appendChild(e.box);
      }

      // 预览
      const pv = previewBox();
      grid.appendChild(pv.box);
      editorWrap.appendChild(grid);

      // 长度提示
      const lenRow = H.el('div', { class: 'len-row', id: 'tpl-len' });
      editorWrap.appendChild(lenRow);

      // 级别映射（保存到渠道 levelMap）
      const lvPanel = H.el('div', { style: 'margin-top:var(--sp-4);' });
      lvPanel.appendChild(H.el('h4', { text: '级别映射（保存到渠道）' }));
      lvPanel.appendChild(H.el('p', {
        class: 'field-hint', style: 'margin-bottom:var(--sp-2);',
        text: `为 ${meta.name} 的每个级别指定参数（默认: ${JSON.stringify((meta.defaultLevelMap) || {})}）。`,
      }));
      const lvGrid = H.el('div', { class: 'form-grid', style: 'grid-template-columns:repeat(4,1fr);' });
      const levelInputs = {};
      for (const lv of LEVELS) {
        const wrap = H.el('div', { class: 'field' });
        wrap.appendChild(H.el('label', { text: lv }));
        const inp = H.el('input', {
          type: 'text', class: 'mono',
          placeholder: (meta.defaultLevelMap && meta.defaultLevelMap[lv] != null)
            ? String(meta.defaultLevelMap[lv]) : '（默认）',
          value: (channel.levelMap && channel.levelMap[lv] != null) ? String(channel.levelMap[lv]) : '',
        });
        levelInputs[lv] = inp;
        wrap.appendChild(inp);
        lvGrid.appendChild(wrap);
      }
      lvPanel.appendChild(lvGrid);
      editorWrap.appendChild(lvPanel);

      // 保存按钮
      const saveBtn = H.el('button', {
        class: 'btn btn-primary', text: '保存到渠道', style: 'margin-top:var(--sp-4);',
      });
      editorWrap.appendChild(saveBtn);

      // 实时预览（input 时刷新）
      function refresh() {
        const val = editor.getValue();
        const renderedTitle = T.render(val.title || '{{title}}', SAMPLE);
        const renderedBody = T.render(val.body || '{{body}}', SAMPLE);
        const content = renderedTitle + (renderedBody ? '\n\n' + renderedBody : '');
        pv.render(content);
        // 长度
        const len = content.length;
        const over = len > maxLen;
        const lenEl = document.getElementById('tpl-len');
        if (lenEl) {
          lenEl.textContent = `${len} / ${maxLen} 字符（该渠道上限 ${maxLen}）`;
          lenEl.className = 'len-row' + (over ? ' len-over' : '');
        }
      }

      editorWrap.querySelectorAll('input,textarea').forEach((el2) => {
        el2.addEventListener('input', refresh);
      });
      refresh();

      saveBtn.addEventListener('click', async () => {
        const val = editor.getValue();
        const levelMap = {};
        for (const lv of LEVELS) {
          const inp = levelInputs[lv];
          if (inp && inp.value.trim() !== '') levelMap[lv] = inp.value.trim();
        }
        saveBtn.disabled = true;
        try {
          await H.api(`/api/channels/${chId}`, {
            method: 'PUT',
            body: {
              template: { title: val.title !== undefined ? val.title : tpl.title, body: val.body },
              levelMap,
            },
          });
          H.toast('模板已保存', 'ok');
          saveBtn.disabled = false;
        } catch (e) { H.toast(e.message, 'err'); saveBtn.disabled = false; }
      });
    }

    btnSimple.addEventListener('click', () => {
      mode = 'simple';
      btnSimple.className = 'btn btn-sm btn-primary';
      btnTpl.className = 'btn btn-sm';
      buildEditor();
    });
    btnTpl.addEventListener('click', () => {
      mode = 'tpl';
      btnSimple.className = 'btn btn-sm';
      btnTpl.className = 'btn btn-sm btn-primary';
      buildEditor();
    });

    buildEditor();
  }

  window.HookHubViews = window.HookHubViews || {};
  window.HookHubViews.templates = { render: (box) => renderTemplates(box) };
})();