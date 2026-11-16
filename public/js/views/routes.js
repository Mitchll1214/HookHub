// 路由与分发视图：可视化条件编辑 + 目标多选（渠道/渠道组）+ 降级链 + 优先级
// 依赖：common.js（HookHub）

(function () {
  const H = window.HookHub;
  let currentBox = null;

  async function loadData() {
    const [routes, channels, groups, meta] = await Promise.all([
      H.api('/api/routes'),
      H.api('/api/channels'),
      H.api('/api/groups'),
      H.api('/api/meta'),
    ]);
    return {
      routes: routes.routes || [],
      channels: channels.channels || [],
      groups: groups.groups || [],
      levels: meta.levels || ['info', 'success', 'warning', 'error'],
    };
  }

  // 目标选择器（渠道 + 群组多选）
  function targetPicker(channels, groups, selected) {
    const box = H.el('div');
    box.appendChild(H.el('label', { text: '发送到（并行分发）' }));

    const chList = H.el('div', { class: 'check-list', style: 'max-height:190px;margin-bottom:8px;' });
    chList.appendChild(H.el('div', { class: 'field-hint', text: '渠道' }));
    if (!channels.length) {
      chList.appendChild(H.el('p', { class: 'field-hint', text: '（还没有渠道，请先在「渠道管理」添加）' }));
    }
    for (const ch of channels) {
      const lab = H.el('label', { class: 'check-item' });
      const cb = H.el('input', { type: 'checkbox', value: `channel:${ch.id}` });
      if (selected.includes(`channel:${ch.id}`)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(H.el('span', { text: ch.name || ch.type }));
      if (!ch.enabled) lab.appendChild(H.el('span', { class: 'badge badge-off', text: '停用' }));
      chList.appendChild(lab);
    }
    box.appendChild(chList);

    const gList = H.el('div', { class: 'check-list', style: 'max-height:140px;' });
    gList.appendChild(H.el('div', { class: 'field-hint', text: '渠道组' }));
    if (!groups.length) {
      gList.appendChild(H.el('p', { class: 'field-hint', text: '（还没有渠道组，可在下方「渠道组」创建）' }));
    }
    for (const g of groups) {
      const lab = H.el('label', { class: 'check-item' });
      const cb = H.el('input', { type: 'checkbox', value: `group:${g.name}` });
      if (selected.includes(`group:${g.name}`)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(H.el('span', { text: g.name, style: 'font-family:var(--mono);' }));
      if (!g.enabled) lab.appendChild(H.el('span', { class: 'badge badge-off', text: '停用' }));
      gList.appendChild(lab);
    }
    box.appendChild(gList);

    return {
      box,
      getValue: () => Array.from(box.querySelectorAll('input[type=checkbox]:checked')).map((c) => c.value),
    };
  }

  // 表单分区：标题 + 说明 + 内容（替代 modal 里 panel 套 panel）
  function section(title, desc, children) {
    const box = H.el('div', { class: 'form-section' });
    if (title) box.appendChild(H.el('h4', { text: title }));
    if (desc) box.appendChild(H.el('p', { class: 'field-hint', text: desc }));
    for (const c of [].concat(children || [])) if (c) box.appendChild(c);
    return box;
  }

  // 路由表单
  function routeForm({ channels, groups, levels }, existing) {
    const div = H.el('div');
    const w = (existing && existing.when) || {};

    // ---- 基础 ----
    const nameField = H.el('div', { class: 'field' });
    nameField.appendChild(H.el('label', { text: '路由名称' }));
    const nameInput = H.el('input', {
      type: 'text', placeholder: '如：所有错误消息 → 值班组',
      value: existing ? existing.name || '' : '',
    });
    nameField.appendChild(nameInput);

    const priField = H.el('div', { class: 'field' });
    priField.appendChild(H.el('label', { text: '优先级（数值大优先匹配）' }));
    const priInput = H.el('input', {
      type: 'number', value: existing ? existing.priority || 0 : 0, min: 0,
    });
    priField.appendChild(priInput);
    div.appendChild(section(null, null, [H.el('div', { class: 'form-grid' }, [nameField, priField])]));

    // ---- 匹配条件 ----
    const grid = H.el('div', { class: 'form-grid' });

    const fChannel = H.el('div', { class: 'field' });
    fChannel.appendChild(H.el('label', { text: 'channel 字段等于' }));
    const inChannel = H.el('input', {
      type: 'text', placeholder: '如 bark（留空不限制）', value: w.channel || '',
    });
    fChannel.appendChild(inChannel);
    grid.appendChild(fChannel);

    const fLevel = H.el('div', { class: 'field' });
    fLevel.appendChild(H.el('label', { text: 'level 等于' }));
    const selLevel = H.el('select');
    selLevel.appendChild(H.el('option', { value: '', text: '（不限）' }));
    for (const lv of levels) {
      const o = H.el('option', { value: lv, text: lv });
      if (w.level === lv) o.selected = true;
      selLevel.appendChild(o);
    }
    fLevel.appendChild(selLevel);
    grid.appendChild(fLevel);

    const fTags = H.el('div', { class: 'field' });
    fTags.appendChild(H.el('label', { text: '必须包含的 tags（逗号分隔）' }));
    const inTags = H.el('input', {
      type: 'text', placeholder: 'disk,prod', value: (w.tags || []).join(','),
    });
    fTags.appendChild(inTags);
    grid.appendChild(fTags);

    const fData = H.el('div', { class: 'field' });
    fData.appendChild(H.el('label', { text: 'data 字段匹配' }));
    const dWrap = H.el('div', { style: 'display:flex;gap:6px;' });
    const dKey = H.el('input', {
      type: 'text', placeholder: 'data 路径，如 event.type',
      class: 'mono', style: 'flex:1;min-width:0;', value: (w.data && w.data.key) || '',
    });
    const dVal = H.el('input', {
      type: 'text', placeholder: '等于', class: 'mono', style: 'flex:1;min-width:0;',
      value: (w.data && w.data.value != null) ? String(w.data.value) : '',
    });
    dWrap.appendChild(dKey);
    dWrap.appendChild(dVal);
    fData.appendChild(dWrap);
    grid.appendChild(fData);

    div.appendChild(section('匹配条件', '留空 = 匹配所有消息。多个条件为「且」关系。', grid));

    // ---- 目标 ----
    const picker = targetPicker(channels, groups, (existing && existing.targets) || []);
    div.appendChild(section(null, null, picker.box));

    // ---- 降级链 ----
    const failPicker = targetPicker(channels, groups, (existing && existing.failover) || []);
    div.appendChild(section('降级链（可选）', '主目标全部失败后，自动切到以下目标。', failPicker.box));

    return {
      div,
      getValue() {
        const tags = inTags.value.split(',').map((s) => s.trim()).filter(Boolean);
        const when = {};
        const ch = inChannel.value.trim();
        const lv = selLevel.value;
        const dk = dKey.value.trim();
        const dv = dVal.value.trim();
        if (ch) when.channel = ch;
        if (lv) when.level = lv;
        if (tags.length) when.tags = tags;
        if (dk) when.data = { key: dk, value: dv };
        return {
          name: nameInput.value.trim(),
          priority: Number(priInput.value) || 0,
          when,
          targets: picker.getValue(),
          failover: failPicker.getValue(),
          parallel: true,
        };
      },
    };
  }

  // ---------- 主渲染 ----------
  async function renderRoutes(box) {
    currentBox = box;
    box.innerHTML = '';
    const data = await loadData();

    box.appendChild(H.pageHead({
      kicker: 'Routes',
      title: '路由与分发',
      desc: '每条路由定义「什么消息 → 发到哪些渠道」。按优先级从高到低匹配，命中后并行分发，主目标全失败时走降级链。',
      actions: H.primaryAction('新增路由', () => addRoute(data)),
    }));

    // ---- 路由列表 ----
    if (!data.routes.length) {
      box.appendChild(H.emptyState({
        iconName: 'routes',
        title: '还没有配置路由',
        desc: '未匹配任何路由的消息会发到「全局设置 → 默认兜底渠道」。想让不同级别、不同业务的消息走不同渠道时再来配置。',
        action: H.primaryAction('新增第一条路由', () => addRoute(data)),
      }));
    } else {
      const enabled = data.routes.filter((r) => r.enabled !== false).length;
      const panel = H.el('div', { class: 'panel', style: 'padding:0;' });
      panel.appendChild(H.el('div', { class: 'list-bar' }, [
        H.el('span', { class: 'list-bar-title', text: `共 ${data.routes.length} 条路由` }),
        H.el('span', { class: 'list-bar-meta', text: `${enabled} 条启用中 · 按优先级降序匹配` }),
      ]));

      const tableBox = H.el('div', { class: 'table-wrap', style: 'border:0;border-radius:0;' });
      const table = H.el('table');
      const thead = H.el('thead');
      const trh = H.el('tr');
      ['名称', '匹配条件', '目标', '优先级', '状态', '操作'].forEach((t, i) => {
        trh.appendChild(H.el('th', { text: t, class: i === 5 ? 'th-actions' : null }));
      });
      thead.appendChild(trh);
      table.appendChild(thead);
      const tbody = H.el('tbody');

      for (const r of data.routes) {
        tbody.appendChild(renderRouteRow(r, data, box));
      }
      table.appendChild(tbody);
      tableBox.appendChild(table);
      panel.appendChild(tableBox);
      box.appendChild(panel);
    }

    // ---- 渠道组 ----
    box.appendChild(renderGroupsPanel(data, box));
  }

  function renderRouteRow(r, data, box) {
    const w = r.when || {};
    const tr = H.el('tr');

    // 名称 + id
    const tdName = H.el('td');
    tdName.appendChild(H.el('div', { text: r.name || r.id, style: 'font-weight:600;color:var(--text);' }));
    tdName.appendChild(H.el('div', { class: 'cell-id', text: r.id }));
    tr.appendChild(tdName);

    // 匹配条件：chip 逐个渲染，避免 innerHTML 拼接
    const condRow = H.el('div', { class: 'chip-row' });
    if (w.channel) condRow.appendChild(H.el('span', { class: 'tag', text: `channel=${w.channel}` }));
    if (w.level) condRow.appendChild(H.el('span', { class: 'tag', text: `level=${w.level}` }));
    if (w.tags && w.tags.length) w.tags.forEach((t) => condRow.appendChild(H.el('span', { class: 'tag', text: `#${t}` })));
    if (w.data && w.data.key) condRow.appendChild(H.el('span', { class: 'tag', text: `${w.data.key}=${w.data.value}` }));
    const tdCond = H.el('td');
    if (condRow.childNodes.length) tdCond.appendChild(condRow);
    else tdCond.appendChild(H.el('span', { class: 'cell-muted', text: '匹配所有' }));
    tr.appendChild(tdCond);

    // 目标
    const tdT = H.el('td', { style: 'max-width:240px;' });
    const tgtRow = H.el('div', { class: 'chip-row' });
    for (const t of r.targets || []) {
      if (t.startsWith('group:')) {
        tgtRow.appendChild(H.el('span', { class: 'tag is-group', text: t.slice(6) }));
      } else {
        const id = t.replace(/^channel:/, '');
        const ch = data.channels.find((c) => c.id === id);
        tgtRow.appendChild(H.el('span', { class: 'tag', text: ch ? (ch.name || ch.type) : id }));
      }
    }
    if (tgtRow.childNodes.length) tdT.appendChild(tgtRow);
    else tdT.appendChild(H.el('span', { class: 'cell-muted', text: '—' }));
    if ((r.failover || []).length) {
      const names = (r.failover || []).map((t) => {
        if (t.startsWith('group:')) return t.slice(6);
        const id = t.replace(/^channel:/, '');
        const ch = data.channels.find((c) => c.id === id);
        return ch ? (ch.name || ch.type) : id;
      });
      tdT.appendChild(H.el('div', { class: 'cell-id', text: `降级 → ${names.join('、')}` }));
    }
    tr.appendChild(tdT);

    // 优先级
    tr.appendChild(H.el('td', { text: String(r.priority || 0), class: 'cell-time', style: 'text-align:center;' }));

    // 状态
    const st = H.el('td');
    st.appendChild(H.el('span', {
      class: 'badge ' + (r.enabled !== false ? 'badge-ok' : 'badge-off'),
      text: r.enabled !== false ? '启用' : '停用',
    }));
    tr.appendChild(st);

    // 操作
    const act = H.el('td', { class: 'actions' });
    const btnEdit = actionBtn('编辑');
    const btnToggle = actionBtn(r.enabled !== false ? '停用' : '启用');
    const btnDel = actionBtn('删除', 'btn-danger');
    act.appendChild(btnEdit);
    act.appendChild(btnToggle);
    act.appendChild(btnDel);
    tr.appendChild(act);

    btnEdit.addEventListener('click', () => editRoute(r, data));
    btnToggle.addEventListener('click', async () => {
      try {
        await H.api(`/api/routes/${r.id}`, { method: 'PUT', body: { enabled: r.enabled === false } });
        H.toast(r.enabled === false ? '已启用' : '已停用', 'ok');
        renderRoutes(box);
      } catch (e) { H.toast(e.message, 'err'); }
    });
    btnDel.addEventListener('click', async () => {
      const yes = await H.confirmDialog(`确定删除路由「${r.name || r.id}」？`, { danger: true });
      if (!yes) return;
      try {
        await H.api(`/api/routes/${r.id}`, { method: 'DELETE' });
        H.toast('已删除', 'ok');
        renderRoutes(box);
      } catch (e) { H.toast(e.message, 'err'); }
    });
    return tr;
  }

  function actionBtn(text, extra) {
    return H.el('button', { class: 'btn btn-sm' + (extra ? ' ' + extra : ''), text, type: 'button' });
  }

  // ---------- 渠道组 ----------
  function renderGroupsPanel(data, box) {
    const panel = H.el('div', { class: 'panel', style: 'padding:0;' });
    const head = H.el('div', { class: 'list-bar' });
    const titleBox = H.el('div');
    titleBox.appendChild(H.el('span', { class: 'list-bar-title', text: '渠道组' }));
    titleBox.appendChild(H.el('div', {
      class: 'cell-muted',
      text: '一次配置、多处复用。例如 oncall = Bark + 企微 + Telegram。',
    }));
    head.appendChild(titleBox);
    head.appendChild(H.primaryAction('新建组', () => addGroup(data.channels, box)));
    panel.appendChild(head);

    const groups = data.groups;
    if (!groups.length) {
      panel.appendChild(H.emptyState({
        iconName: 'layers',
        title: '还没有渠道组',
        desc: '把常用的几个渠道打包成一个组，路由里选组即可，不必逐个勾选。',
        action: H.primaryAction('新建渠道组', () => addGroup(data.channels, box)),
      }));
      return panel;
    }

    const tableBox = H.el('div', { class: 'table-wrap', style: 'border:0;border-radius:0;' });
    const table = H.el('table');
    const trh = H.el('tr');
    ['组名', '包含渠道', '状态', '操作'].forEach((t, i) => {
      trh.appendChild(H.el('th', { text: t, class: i === 3 ? 'th-actions' : null }));
    });
    const thead = H.el('thead');
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = H.el('tbody');

    for (const g of groups) {
      const tr = H.el('tr');
      tr.appendChild(H.el('td', { text: g.name, style: 'font-family:var(--mono);color:var(--text);' }));

      const names = (g.channels || []).map((id) => {
        const ch = data.channels.find((c) => c.id === id);
        return ch ? (ch.name || ch.type) : id;
      });
      const cellCh = H.el('td', { class: 'cell-summary', title: names.join('、') });
      cellCh.textContent = names.length ? names.join('、') : '—';
      tr.appendChild(cellCh);

      const st = H.el('td');
      st.appendChild(H.el('span', {
        class: 'badge ' + (g.enabled !== false ? 'badge-ok' : 'badge-off'),
        text: g.enabled !== false ? '启用' : '停用',
      }));
      tr.appendChild(st);

      const act = H.el('td', { class: 'actions' });
      const btnEdit = actionBtn('编辑');
      const btnDel = actionBtn('删除', 'btn-danger');
      act.appendChild(btnEdit);
      act.appendChild(btnDel);
      tr.appendChild(act);

      btnEdit.addEventListener('click', () => editGroup(g, data.channels, box));
      btnDel.addEventListener('click', async () => {
        const yes = await H.confirmDialog(`确定删除渠道组「${g.name}」？引用它的路由将失效。`, { danger: true });
        if (!yes) return;
        try {
          await H.api(`/api/groups/${encodeURIComponent(g.name)}`, { method: 'DELETE' });
          H.toast('已删除', 'ok');
          renderRoutes(box);
        } catch (e) { H.toast(e.message, 'err'); }
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableBox.appendChild(table);
    panel.appendChild(tableBox);
    return panel;
  }

  function groupForm(channels, existing) {
    const div = H.el('div');
    const nameField = H.el('div', { class: 'field' });
    nameField.appendChild(H.el('label', { text: '组名' }));
    const nameInput = H.el('input', {
      type: 'text', placeholder: '如 oncall', class: 'mono',
      value: existing ? existing.name : '',
      disabled: existing ? 'disabled' : null,
    });
    nameField.appendChild(nameInput);
    if (existing) nameField.appendChild(H.el('div', { class: 'field-hint', text: '组名创建后不可修改。' }));
    div.appendChild(nameField);

    const chField = H.el('div', { class: 'field' });
    chField.appendChild(H.el('label', { text: '包含渠道' }));
    const list = H.el('div', { class: 'check-list', style: 'max-height:240px;' });
    if (!channels.length) {
      list.appendChild(H.el('p', { class: 'field-hint', text: '还没有渠道，请先在「渠道管理」添加。' }));
    }
    for (const ch of channels) {
      const lab = H.el('label', { class: 'check-item' });
      const cb = H.el('input', { type: 'checkbox', value: ch.id });
      if (existing && (existing.channels || []).includes(ch.id)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(H.el('span', { text: ch.name || ch.type }));
      list.appendChild(lab);
    }
    chField.appendChild(list);
    div.appendChild(chField);

    return {
      div,
      getValue: () => ({
        name: nameInput.value.trim(),
        channels: Array.from(list.querySelectorAll('input:checked')).map((c) => c.value),
      }),
    };
  }

  function addGroup(channels, box) {
    const form = groupForm(channels, null);
    H.formModal({
      title: '新建渠道组',
      content: form.div,
      submitText: '创建',
      onSubmit: async () => {
        const val = form.getValue();
        if (!val.name) { H.toast('请填写组名', 'err'); return false; }
        await H.api('/api/groups', { method: 'POST', body: val });
        H.toast('渠道组已创建', 'ok');
        renderRoutes(box || currentBox);
      },
    });
  }

  function editGroup(g, channels, box) {
    const form = groupForm(channels, g);
    H.formModal({
      title: `编辑渠道组 · ${g.name}`,
      content: form.div,
      onSubmit: async () => {
        await H.api(`/api/groups/${encodeURIComponent(g.name)}`, { method: 'PUT', body: form.getValue() });
        H.toast('已保存', 'ok');
        renderRoutes(box || currentBox);
      },
    });
  }

  // ---------- 路由增改 ----------
  function addRoute(data) {
    const form = routeForm(data, null);
    H.formModal({
      title: '新增路由',
      content: form.div,
      large: true,
      submitText: '创建',
      onSubmit: async () => {
        const val = form.getValue();
        if (!val.targets.length) { H.toast('请至少选择一个目标渠道或渠道组', 'err'); return false; }
        await H.api('/api/routes', { method: 'POST', body: val });
        H.toast('路由已创建', 'ok');
        renderRoutes(currentBox);
      },
    });
  }

  function editRoute(r, data) {
    const form = routeForm(data, r);
    H.formModal({
      title: `编辑路由 · ${r.name || r.id}`,
      content: form.div,
      large: true,
      onSubmit: async () => {
        const val = form.getValue();
        if (!val.targets.length) { H.toast('请至少选择一个目标渠道或渠道组', 'err'); return false; }
        await H.api(`/api/routes/${r.id}`, { method: 'PUT', body: val });
        H.toast('已保存', 'ok');
        renderRoutes(currentBox);
      },
    });
  }

  window.HookHubViews = window.HookHubViews || {};
  window.HookHubViews.routes = { render: (box) => renderRoutes(box) };
})();