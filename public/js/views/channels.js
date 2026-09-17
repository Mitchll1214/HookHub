// 渠道管理视图：列表 / 新增 / 编辑 / 删除 / 启用停用 / 测试发送 / 脱敏展示
// 依赖：common.js（HookHub）

(function () {
  const H = window.HookHub;
  let currentBox = null; // 当前渲染容器（供刷新用）

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
    nameRow.appendChild(H.el('input', {
      type: 'text', id: 'ch-name', placeholder: '如：手机 Bark',
      value: existing ? existing.name || '' : '',
    }));
    div.appendChild(nameRow);

    const cfgBox = H.el('div', { id: 'ch-config-fields' });
    div.appendChild(cfgBox);

    const lvBox = H.el('div', { id: 'ch-level-map', class: 'panel', style: 'padding:var(--sp-3);' });
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
        wrap.appendChild(H.el('div', { class: 'field-hint', text: f.placeholder || '' }));
        grid.appendChild(wrap);
      }
      cfgBox.appendChild(grid);
      renderLevelMap(meta);
    }

    function renderLevelMap(meta) {
      lvBox.innerHTML = '';
      lvBox.appendChild(H.el('div', {
        class: 'panel-title', style: 'font-size:var(--fs-m);margin-bottom:var(--sp-2);',
        text: '级别映射（可选，覆盖默认值）',
      }));
      const defaults = (meta && meta.defaultLevelMap) || {};
      const cur = (existing && existing.levelMap) || {};
      const grid = H.el('div', { class: 'form-grid', style: 'grid-template-columns:repeat(4,1fr);' });
      for (const lv of levelOptions) {
        const wrap = H.el('div', { class: 'field' });
        wrap.appendChild(H.el('label', { text: lv }));
        wrap.appendChild(H.el('input', {
          type: 'text', 'data-lv': lv, class: 'mono',
          placeholder: defaults[lv] != null ? String(defaults[lv]) : '（默认）',
          value: cur[lv] != null ? String(cur[lv]) : '',
        }));
        grid.appendChild(wrap);
      }
      lvBox.appendChild(grid);
    }

    typeSelect.addEventListener('change', renderFields);
    renderFields();

    // 渠道级模板覆盖
    const tplBox = H.el('div', { class: 'field span-2', style: 'margin-top:var(--sp-4);' });
    tplBox.appendChild(H.el('h4', { text: '消息模板覆盖（可选）', style: 'margin-bottom:var(--sp-2);' }));
    tplBox.appendChild(H.el('p', {
      class: 'field-hint',
      text: '留空则使用全局模板与默认格式。支持 {{title}} {{body}} {{level}} {{tags}} {{url}} {{data.xxx}} 等占位符与 {{#if}} 条件块。',
    }));
    tplBox.appendChild(H.el('label', { text: '标题格式' }));
    const titleTpl = H.el('input', {
      type: 'text', id: 'ch-tpl-title', placeholder: '如：{{title}} 🔴',
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
          name: document.getElementById('ch-name').value.trim(),
          config,
          levelMap,
          template: {
            title: document.getElementById('ch-tpl-title').value,
            body: document.getElementById('ch-tpl-body').value,
          },
        };
      },
    };
  }

  // ---------- 主渲染 ----------
  async function renderChannels(box) {
    currentBox = box;
    box.innerHTML = '';
    const { channels, adapters } = await loadAll();

    const wrap = H.el('div', { class: 'panel' });
    const head = H.el('div', { class: 'panel-head' });
    const titleBox = H.el('div');
    titleBox.appendChild(H.el('h2', { class: 'panel-title', text: '渠道管理' }));
    titleBox.appendChild(H.el('div', {
      class: 'panel-desc',
      text: '配置各推送渠道。密钥在列表中仅显示后 4 位，编辑保存时才会更新。',
    }));
    head.appendChild(titleBox);
    const addBtn = H.el('button', { class: 'btn btn-primary', text: '+ 新增渠道' });
    head.appendChild(addBtn);
    wrap.appendChild(head);

    if (!channels.length) {
      const empty = H.el('div', { class: 'empty' });
      empty.appendChild(H.el('div', { class: 'callout', text: '还没有渠道，点击「新增渠道」开始配置。' }));
      wrap.appendChild(empty);
    } else {
      const tableBox = H.el('div', { class: 'table-wrap' });
      const table = H.el('table');
      const thead = H.el('thead');
      const trh = H.el('tr');
      ['名称', '类型', '配置摘要', '状态', '操作'].forEach((t) => trh.appendChild(H.el('th', { text: t })));
      thead.appendChild(trh);
      table.appendChild(thead);
      const tbody = H.el('tbody');

      for (const ch of channels) {
        const meta = adapters.find((a) => a.id === ch.type);
        const typeName = meta ? meta.name : ch.type;
        const cfg = ch.configMasked || {};
        const summary = Object.entries(cfg)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join(' · ');

        const tr = H.el('tr');
        tr.appendChild(H.el('td', { text: ch.name || typeName }));
        tr.appendChild(H.el('td', { text: typeName, style: 'white-space:nowrap;' }));
        tr.appendChild(H.el('td', {
          text: summary || '—',
          style: 'font-family:var(--mono);font-size:var(--fs-xs);color:var(--text-2);max-width:280px;word-break:break-all;',
        }));

        const st = H.el('td');
        st.appendChild(H.el('span', {
          class: 'badge ' + (ch.enabled ? 'badge-ok' : 'badge-off'),
          text: ch.enabled ? '已启用' : '已停用',
        }));
        tr.appendChild(st);

        const tdAct = H.el('td', { class: 'actions' });
        const btnTest = H.el('button', { class: 'btn btn-sm', text: '测试' });
        const btnEdit = H.el('button', { class: 'btn btn-sm', text: '编辑' });
        const btnToggle = H.el('button', { class: 'btn btn-sm', text: ch.enabled ? '停用' : '启用' });
        const btnDel = H.el('button', { class: 'btn btn-sm btn-danger', text: '删除' });
        tdAct.appendChild(btnTest);
        tdAct.appendChild(btnEdit);
        tdAct.appendChild(btnToggle);
        tdAct.appendChild(btnDel);
        tr.appendChild(tdAct);

        btnTest.addEventListener('click', () => runTest(ch));
        btnEdit.addEventListener('click', () => openEdit(adapters, ch));
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
      wrap.appendChild(tableBox);
    }

    box.appendChild(wrap);
    addBtn.addEventListener('click', () => openAdd(adapters));
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
    const foot = H.el('div', { class: 'modal-foot' });
    const cancel = H.el('button', { class: 'btn', text: '取消' });
    const save = H.el('button', { class: 'btn btn-primary', text: '保存' });
    foot.appendChild(cancel);
    foot.appendChild(save);
    const m = H.openModal({ title: '新增渠道', content: form.div, footer: foot, large: true });
    cancel.addEventListener('click', m.close);
    save.addEventListener('click', async () => {
      const val = form.getValue();
      if (!val.type) { H.toast('请选择渠道类型', 'err'); return; }
      save.disabled = true;
      try {
        await H.api('/api/channels', { method: 'POST', body: val });
        H.toast('渠道已创建', 'ok');
        m.close();
        renderChannels(currentBox);
      } catch (e) { H.toast(e.message, 'err'); save.disabled = false; }
    });
  }

  // 编辑（需要完整配置，含密钥）
  function openEdit(adapters, ch) {
    H.api(`/api/channels/${ch.id}`).then((data) => {
      const full = data.channel;
      const form = channelForm(adapters, full);
      const foot = H.el('div', { class: 'modal-foot' });
      const cancel = H.el('button', { class: 'btn', text: '取消' });
      const save = H.el('button', { class: 'btn btn-primary', text: '保存' });
      foot.appendChild(cancel);
      foot.appendChild(save);
      const m = H.openModal({ title: `编辑渠道 · ${full.name || full.type}`, content: form.div, footer: foot, large: true });
      cancel.addEventListener('click', m.close);
      save.addEventListener('click', async () => {
        const val = form.getValue();
        save.disabled = true;
        try {
          await H.api(`/api/channels/${full.id}`, { method: 'PUT', body: val });
          H.toast('已保存', 'ok');
          m.close();
          renderChannels(currentBox);
        } catch (e) { H.toast(e.message, 'err'); save.disabled = false; }
      });
    }).catch((e) => H.toast(e.message, 'err'));
  }

  window.HookHubViews = window.HookHubViews || {};
  window.HookHubViews.channels = {
    render: (box) => renderChannels(box),
  };
})();