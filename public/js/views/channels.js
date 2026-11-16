// 渠道管理视图：列表 / 新增 / 编辑 / 删除 / 启用停用 / 测试发送 / 脱敏展示
// 依赖：common.js（HookHub）

(function () {
  const H = window.HookHub;
  let currentBox = null; // 当前渲染容器（供刷新用）
  let adaptersCache = null;

  async function loadAll() {
    const [chData, metaData] = await Promise.all([
      H.api('/api/channels'),
      H.api('/api/meta'),
    ]);
    return { channels: chData.channels || [], adapters: metaData.adapters || [] };
  }

  // 渲染渠道表单（新增/编辑共用）
  function channelForm(adapters, existing) {
    const div = H.el('div');
    const typeRow = H.el('div', { class: 'field' });
    typeRow.appendChild(H.el('label', { text: '渠道类型' }));
    const typeSelect = H.el('select', { id: 'ch-type', disabled: existing ? 'disabled' : null });
    for (const a of adapters) {
      const opt = H.el('option', { value: a.id, text: `${a.name}（${a.id}）` });
      if (existing && existing.type === a.id) opt.selected = true;
      typeSelect.appendChild(opt);
    }
    typeRow.appendChild(typeSelect);
    div.appendChild(typeRow);

    const nameRow = H.el('div', { class: 'field' });
    nameRow.appendChild(H.el('label', { text: '渠道名称（可选）' }));
    const nameInput = H.el('input', {
      type: 'text', id: 'ch-name', placeholder: '如：手机 Bark',
      value: existing ? existing.name || '' : '',
    });
    nameRow.appendChild(nameInput);
    div.appendChild(nameRow);

    const cfgBox = H.el('div', { id: 'ch-config-fields' });
    div.appendChild(cfgBox);

    const lvBox = H.el('div', { class: 'panel', style: 'padding:var(--sp-3);' });
    div.appendChild(lvBox);

    const levelOptions = ['info', 'success', 'warning', 'error'];

    function renderFields() {
      const type = typeSelect.value;
      const meta = adapters.find((x) => x.id === type);
      cfgBox.innerHTML = '';
      if (!meta) { cfgBox.appendChild(H.el('p', { text: '未知渠道类型' })); return; }
      const grid = H.el('div', { class: 'form-grid' });
      const config = (existing && existing.config) || {};
      for (const f of meta.fields) {
        const wrap = H.el('div', { class: f.type === 'textarea' ? 'field span-2' : 'field' });
        wrap.appendChild(H.el('label', { text: f.label + (f.required ? ' *' : '') }));
        const val = config[f.key] != null ? config[f.key] : (f.default != null ? f.default : '');
        if (f.type === 'select') {
          const sel = H.el('select', { 'data-key': f.key });
          for (const opt of f.options || []) {
            const o = H.el('option', { value: opt, text: String(opt) });
            if (String(opt) === String(val)) o.selected = true;
            sel.appendChild(o);
          }
          wrap.appendChild(sel);
        } else if (f.type === 'textarea') {
          wrap.appendChild(H.el('textarea', {
            'data-key': f.key, placeholder: f.placeholder || '',
            class: 'mono', text: String(val),
          }));
        } else {
          wrap.appendChild(H.el('input', {
            type: 'text', 'data-key': f.key, placeholder: f.placeholder || '',
            value: String(val),
            class: /key|token|secret|password|sendkey|api/i.test(f.key) ? 'mono' : '',
          }));
        }
        // 占位文案已在上方 placeholder 展示，避免同一句话重复两遍
        grid.appendChild(wrap);
      }
      cfgBox.appendChild(grid);
      renderLevelMap(meta);
    }

    function renderLevelMap(meta) {
      lvBox.innerHTML = '';
      lvBox.appendChild(H.el('h4', {
        style: 'margin:0 0 var(--sp-1);font-size:var(--fs-m);',
        text: '级别映射（可选，覆盖默认值）',
      }));
      lvBox.appendChild(H.el('p', {
        class: 'field-hint', style: 'margin:0 0 var(--sp-3);',
        text: '按消息级别覆盖渠道参数（如 Bark 的 critical）。留空即使用默认值。',
      }));
      const defaults = (meta && meta.defaultLevelMap) || {};
      const cur = (existing && existing.levelMap) || {};
      const grid = H.el('div', { class: 'form-grid', style: 'grid-template-columns:repeat(4,1fr);' });
      for (const lv of levelOptions) {
        const wrap = H.el('div', { class: 'field', style: 'margin:0;' });
        wrap.appendChild(H.el('label', { text: lv }));
        wrap.appendChild(H.el('input', {
          type: 'text', 'data-lv': lv, class: 'mono',
          placeholder: defaults[lv] != null ? String(defaults[lv]) : '默认',
          value: cur[lv] != null ? String(cur[lv]) : '',
        }));
        grid.appendChild(wrap);
      }
      lvBox.appendChild(grid);
    }

    typeSelect.addEventListener('change', renderFields);
    renderFields();

    // 渠道级模板覆盖
    const tplBox = H.el('div', { style: 'margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:1px solid var(--border);' });
    tplBox.appendChild(H.el('h4', { text: '消息模板覆盖（可选）', style: 'margin-bottom:var(--sp-1);' }));
    tplBox.appendChild(H.el('p', {
      class: 'field-hint', style: 'margin-bottom:var(--sp-3);',
      text: '留空则使用全局模板与默认格式。支持 {{title}} {{body}} {{level}} {{tags}} {{url}} {{data.xxx}} 等占位符与 {{#if}} 条件块。',
    }));
    tplBox.appendChild(H.el('label', { text: '标题格式' }));
    const titleTpl = H.el('input', {
      type: 'text', id: 'ch-tpl-title', placeholder: '如：{{title}} 🔴', class: 'mono',
      value: (existing && existing.template && existing.template.title) || '',
    });
    tplBox.appendChild(titleTpl);
    tplBox.appendChild(H.el('label', { text: '正文格式', style: 'margin-top:var(--sp-3);' }));
    const bodyTpl = H.el('textarea', {
      id: 'ch-tpl-body', class: 'mono', style: 'min-height:110px;',
      placeholder: '如：{{#if level=="error"}}【紧急】{{/if}}\n{{body}}',
      text: (existing && existing.template && existing.template.body) || '',
    });
    tplBox.appendChild(bodyTpl);
    div.appendChild(tplBox);

    return {
      div,
      getValue: () => {
        const type = typeSelect.value;
        const config = {};
        cfgBox.querySelectorAll('[data-key]').forEach((e) => { config[e.dataset.key] = e.value; });
        const levelMap = {};
        lvBox.querySelectorAll('[data-lv]').forEach((e) => {
          if (e.value.trim() !== '') levelMap[e.dataset.lv] = e.value.trim();
        });
        return {
          type,
          name: nameInput.value.trim(),
          config,
          levelMap,
          template: {
            title: titleTpl.value,
            body: bodyTpl.value,
          },
        };
      },
    };
  }

  // 配置摘要：只列有值的字段，密钥字段用脱敏值
  function summarizeConfig(cfg) {
    return Object.entries(cfg)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  }

  // ---------- 主渲染 ----------
  async function renderChannels(box) {
    currentBox = box;
    box.innerHTML = ''; // 清掉骨架屏，避免刷新时内容叠加
    const { channels, adapters } = await loadAll();
    adaptersCache = adapters;

    box.appendChild(H.pageHead({
      kicker: 'Channels',
      title: '渠道管理',
      desc: '配置各推送渠道。密钥在列表中仅显示后 4 位；编辑并保存时才会更新。',
      actions: H.primaryAction('新增渠道', () => openAdd(adapters)),
    }));

    if (!channels.length) {
      box.appendChild(H.emptyState({
        iconName: 'channels',
        title: '还没有配置任何渠道',
        desc: '渠道是消息的最终落点，例如 Bark 手机推送、企业微信群机器人。先添加一个，再点「测试」验证连通性。',
        action: H.primaryAction('新增渠道', () => openAdd(adapters)),
      }));
      return;
    }

    const enabled = channels.filter((c) => c.enabled !== false).length;
    const panel = H.el('div', { class: 'panel', style: 'padding:0;' });
    const bar = H.el('div', { class: 'list-bar' }, [
      H.el('span', { class: 'list-bar-title', text: `共 ${channels.length} 个渠道` }),
      H.el('span', { class: 'list-bar-meta', text: `${enabled} 个启用中 · ${channels.length - enabled} 个停用` }),
    ]);
    panel.appendChild(bar);

    const tableBox = H.el('div', { class: 'table-wrap', style: 'border:0;border-radius:0;' });
    const table = H.el('table');
    const thead = H.el('thead');
    const trh = H.el('tr');
    ['名称', '类型', '配置摘要', '状态', '操作'].forEach((t, i) => {
      trh.appendChild(H.el('th', { text: t, class: i === 4 ? 'th-actions' : null }));
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = H.el('tbody');

    for (const ch of channels) {
      const meta = adapters.find((a) => a.id === ch.type);
      const typeName = meta ? meta.name : ch.type;

      const tr = H.el('tr');
      // 名称 + 渠道 id（mono 小字，便于排查）
      const tdName = H.el('td');
      tdName.appendChild(H.el('div', { text: ch.name || typeName, style: 'font-weight:600;color:var(--text);' }));
      tdName.appendChild(H.el('div', { class: 'cell-id', text: ch.id }));
      tr.appendChild(tdName);
      tr.appendChild(H.el('td', null, [H.el('span', { class: 'tag', text: ch.type })]));
      tr.appendChild(H.el('td', {
        text: summarizeConfig(ch.configMasked || {}) || '—',
        class: 'cell-summary',
      }));

      const st = H.el('td');
      st.appendChild(H.el('span', {
        class: 'badge ' + (ch.enabled ? 'badge-ok' : 'badge-off'),
        text: ch.enabled ? '已启用' : '已停用',
      }));
      tr.appendChild(st);

      const tdAct = H.el('td', { class: 'actions' });
      const btnTest = H.el('button', { class: 'btn btn-sm', text: '测试', type: 'button' });
      const btnEdit = H.el('button', { class: 'btn btn-sm', text: '编辑', type: 'button' });
      const btnToggle = H.el('button', { class: 'btn btn-sm', text: ch.enabled ? '停用' : '启用', type: 'button' });
      const btnDel = H.el('button', { class: 'btn btn-sm btn-danger', text: '删除', type: 'button' });
      tdAct.appendChild(btnTest);
      tdAct.appendChild(btnEdit);
      tdAct.appendChild(btnToggle);
      tdAct.appendChild(btnDel);
      tr.appendChild(tdAct);

      btnTest.addEventListener('click', () => runTest(ch));
      btnEdit.addEventListener('click', () => openEdit(ch));
      btnToggle.addEventListener('click', async () => {
        try {
          await H.api(`/api/channels/${ch.id}`, { method: 'PUT', body: { enabled: !ch.enabled } });
          H.toast(ch.enabled ? '已停用' : '已启用', 'ok');
          renderChannels(box);
        } catch (e) { H.toast(e.message, 'err'); }
      });
      btnDel.addEventListener('click', async () => {
        const yes = await H.confirmDialog(`确定删除渠道「${ch.name || typeName}」？此操作不可恢复。`, { danger: true });
        if (!yes) return;
        try {
          await H.api(`/api/channels/${ch.id}`, { method: 'DELETE' });
          H.toast('已删除', 'ok');
          renderChannels(box);
        } catch (e) { H.toast(e.message, 'err'); }
      });

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableBox.appendChild(table);
    panel.appendChild(tableBox);
    box.appendChild(panel);
  }

  // 测试发送
  async function runTest(ch) {
    H.toast('正在发送测试消息…');
    try {
      const data = await H.api(`/api/channels/${ch.id}/test`, { method: 'POST' });
      const ok = data.ok;
      const resBox = H.el('div', { class: 'test-result' });
      const head = H.el('div', {
        class: 'head ' + (ok ? 'ok' : 'fail'),
        text: `${ok ? '发送成功' : '发送失败'} · HTTP ${data.status || 0}${data.error ? ' · ' + data.error : ''}`,
      });
      resBox.appendChild(head);
      resBox.appendChild(H.el('pre', { text: data.raw || '(无响应体)' }));
      H.openModal({ title: `测试发送 · ${ch.name || ch.type}`, content: resBox });
    } catch (e) {
      H.toast('测试失败: ' + e.message, 'err');
    }
  }

  // 新增
  function openAdd(adapters) {
    const form = channelForm(adapters, null);
    H.formModal({
      title: '新增渠道',
      content: form.div,
      large: true,
      submitText: '保存',
      onSubmit: async () => {
        const val = form.getValue();
        if (!val.type) { H.toast('请选择渠道类型', 'err'); return false; }
        await H.api('/api/channels', { method: 'POST', body: val });
        H.toast('渠道已创建', 'ok');
        renderChannels(currentBox);
      },
    });
  }

  // 编辑（需要完整配置，含密钥）
  async function openEdit(ch) {
    let full;
    try {
      const data = await H.api(`/api/channels/${ch.id}`);
      full = data.channel;
    } catch (e) {
      H.toast(e.message, 'err');
      return;
    }
    const adapters = adaptersCache || [];
    const form = channelForm(adapters, full);
    H.formModal({
      title: `编辑渠道 · ${full.name || full.type}`,
      content: form.div,
      large: true,
      submitText: '保存',
      onSubmit: async () => {
        await H.api(`/api/channels/${full.id}`, { method: 'PUT', body: form.getValue() });
        H.toast('已保存', 'ok');
        renderChannels(currentBox);
      },
    });
  }

  window.HookHubViews = window.HookHubViews || {};
  window.HookHubViews.channels = {
    render: async (box) => { await renderChannels(box); },
  };
})();