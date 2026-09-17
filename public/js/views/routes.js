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

    const chWrap = H.el('div', { style: 'max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:8px;' });
    chWrap.appendChild(H.el('div', { class: 'field-hint', style: 'margin-bottom:4px;font-weight:600;', text: '渠道' }));
    if (!channels.length) {
      chWrap.appendChild(H.el('p', { class: 'field-hint', text: '（还没有渠道，请先在「渠道管理」添加）' }));
    }
    for (const ch of channels) {
      const lab = H.el('label', { style: 'display:flex;align-items:center;gap:6px;font-weight:400;font-size:var(--fs-s);cursor:pointer;padding:2px 0;' });
      const cb = H.el('input', { type: 'checkbox', value: `channel:${ch.id}` });
      if (selected.includes(`channel:${ch.id}`)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(`${ch.name || ch.type}`));
      if (!ch.enabled) lab.appendChild(H.el('span', { class: 'badge badge-off', text: '停用' }));
      chWrap.appendChild(lab);
    }
    box.appendChild(chWrap);

    const gWrap = H.el('div', { style: 'max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px;' });
    gWrap.appendChild(H.el('div', { class: 'field-hint', style: 'margin-bottom:4px;font-weight:600;', text: '渠道组' }));
    if (!groups.length) {
      gWrap.appendChild(H.el('p', { class: 'field-hint', text: '（还没有渠道组，可在「路由与分发」下方创建）' }));
    }
    for (const g of groups) {
      const lab = H.el('label', { style: 'display:flex;align-items:center;gap:6px;font-weight:400;font-size:var(--fs-s);cursor:pointer;padding:2px 0;' });
      const cb = H.el('input', { type: 'checkbox', value: `group:${g.name}` });
      if (selected.includes(`group:${g.name}`)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(g.name));
      if (!g.enabled) lab.appendChild(H.el('span', { class: 'badge badge-off', text: '停用' }));
      gWrap.appendChild(lab);
    }
    box.appendChild(gWrap);
    return {
      box,
      getValue: () => Array.from(box.querySelectorAll('input[type=checkbox]:checked')).map((c) => c.value),
    };
  }

  // 路由表单
  function routeForm({ channels, groups, levels }, existing) {
    const div = H.el('div');

    // 基础
    const nameRow = H.el('div', { class: 'field' });
    nameRow.appendChild(H.el('label', { text: '路由名称' }));
    nameRow.appendChild(H.el('input', {
      type: 'text', id: 'rt-name', placeholder: '如：所有错误消息 → 值班组',
      value: existing ? existing.name || '' : '',
    }));
    div.appendChild(nameRow);

    const priRow = H.el('div', { class: 'field' });
    priRow.appendChild(H.el('label', { text: '优先级（数值大优先匹配）' }));
    priRow.appendChild(H.el('input', {
      type: 'number', id: 'rt-priority', value: existing ? existing.priority || 0 : 0, min: 0,
    }));
    div.appendChild(priRow);

    // 匹配条件
    const condPanel = H.el('div', { class: 'panel', style: 'padding:var(--sp-3);' });
    condPanel.appendChild(H.el('h4', { text: '匹配条件（留空 = 匹配所有消息）' }));
    const grid = H.el('div', { class: 'form-grid' });
    const w = existing && existing.when ? existing.when : {};

    const fChannel = H.el('div', { class: 'field' });
    fChannel.appendChild(H.el('label', { text: 'channel 字段等于' }));
    fChannel.appendChild(H.el('input', {
      type: 'text', id: 'rt-when-channel', placeholder: '如 bark（留空不限制）', value: w.channel || '',
    }));
    grid.appendChild(fChannel);

    const fLevel = H.el('div', { class: 'field' });
    fLevel.appendChild(H.el('label', { text: 'level 等于' }));
    const selLevel = H.el('select', { id: 'rt-when-level' });
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
    fTags.appendChild(H.el('input', {
      type: 'text', id: 'rt-when-tags', placeholder: 'disk,prod',
      value: (w.tags || []).join(','),
    }));
    grid.appendChild(fTags);

    const fData = H.el('div', { class: 'field' });
    fData.appendChild(H.el('label', { text: 'data 字段匹配' }));
    const dWrap = H.el('div', { style: 'display:flex;gap:6px;' });
    const dKey = H.el('input', {
      type: 'text', id: 'rt-when-data-key', placeholder: 'data 路径，如 event.type',
      class: 'mono', style: 'flex:1;', value: (w.data && w.data.key) || '',
    });
    const dVal = H.el('input', {
      type: 'text', id: 'rt-when-data-val', placeholder: '等于', class: 'mono', style: 'flex:1;',
      value: (w.data && w.data.value != null) ? String(w.data.value) : '',
    });
    dWrap.appendChild(dKey);
    dWrap.appendChild(dVal);
    fData.appendChild(dWrap);
    grid.appendChild(fData);

    condPanel.appendChild(grid);
    div.appendChild(condPanel);

    // 目标
    const targetBox = H.el('div', { style: 'margin-bottom:var(--sp-4);' });
    div.appendChild(targetBox);
    // 降级
    const failPanel = H.el('div', { class: 'panel', style: 'padding:var(--sp-3);' });
    failPanel.appendChild(H.el('h4', { text: '降级链（主目标全部失败时发送到）' }));
    failPanel.appendChild(H.el('p', { class: 'field-hint', text: '可选：主目标全部失败后，自动切到以下目标。' }));
    const failBox = H.el('div');
    failPanel.appendChild(failBox);
    div.appendChild(failPanel);

    // 编辑时回填目标选择器
    let picker = null;
    function buildPickers() {
      targetBox.innerHTML = '';
      picker = targetPicker(channels, groups, existing ? existing.targets || [] : []);
      targetBox.appendChild(picker.box);
      failBox.innerHTML = '';
      const failPicker = targetPicker(channels, groups, existing ? existing.failover || [] : []);
      failBox.appendChild(failPicker.box);
      window.__failPicker = failPicker;
    }

    return {
      div,
      afterMount() {
        buildPickers();
      },
      getValue() {
        const tags = document.getElementById('rt-when-tags').value.split(',').map((s) => s.trim()).filter(Boolean);
        const when = {};
        const ch = document.getElementById('rt-when-channel').value.trim();
        const lv = document.getElementById('rt-when-level').value;
        const dk = document.getElementById('rt-when-data-key').value.trim();
        const dv = document.getElementById('rt-when-data-val').value.trim();
        if (ch) when.channel = ch;
        if (lv) when.level = lv;
        if (tags.length) when.tags = tags;
        if (dk) when.data = { key: dk, value: dv };
        return {
          name: document.getElementById('rt-name').value.trim(),
          priority: Number(document.getElementById('rt-priority').value) || 0,
          when,
          targets: picker.getValue(),
          failover: window.__failPicker.getValue(),
          parallel: true,
        };
      },
    };
  }

  // 渠道组管理（内嵌在路由页）
  function renderGroupsUI(box, channels) {
    const panel = H.el('div', { class: 'panel' });
    const head = H.el('div', { class: 'panel-head' });
    const titleBox = H.el('div');
    titleBox.appendChild(H.el('h3', { class: 'panel-title', text: '渠道组' }));
    titleBox.appendChild(H.el('div', { class: 'panel-desc', text: '一次配置，多处复用。例如 group:oncall = Bark + 企微 + Telegram。' }));
    head.appendChild(titleBox);
    const addBtn = H.el('button', { class: 'btn btn-primary btn-sm', text: '+ 新建组' });
    head.appendChild(addBtn);
    panel.appendChild(head);

    H.api('/api/groups').then(({ groups }) => {
      const tableBox = H.el('div', { class: 'table-wrap' });
      const table = H.el('table');
      const thead = H.el('thead');
      const trh = H.el('tr');
      ['组名', '包含渠道', '状态', '操作'].forEach((t) => trh.appendChild(H.el('th', { text: t })));
      thead.appendChild(trh);
      table.appendChild(thead);
      const tbody = H.el('tbody');

      for (const g of groups) {
        const tr = H.el('tr');
        tr.appendChild(H.el('td', { text: g.name, style: 'font-family:var(--mono);' }));
        const names = (g.channels || []).map((id) => {
          const ch = channels.find((c) => c.id === id);
          return ch ? (ch.name || ch.type) : id;
        }).join(', ');
        tr.appendChild(H.el('td', { text: names || '—', style: 'font-size:var(--fs-s);color:var(--text-2);' }));
        const st = H.el('td');
        st.appendChild(H.el('span', {
          class: 'badge ' + (g.enabled ? 'badge-ok' : 'badge-off'),
          text: g.enabled ? '启用' : '停用',
        }));
        tr.appendChild(st);
        const act = H.el('td', { class: 'actions' });
        const btnEdit = H.el('button', { class: 'btn btn-sm', text: '编辑' });
        const btnDel = H.el('button', { class: 'btn btn-sm btn-danger', text: '删除' });
        act.appendChild(btnEdit);
        act.appendChild(btnDel);
        tr.appendChild(act);

        btnEdit.addEventListener('click', () => editGroup(g, channels));
        btnDel.addEventListener('click', async () => {
          const yes = await H.confirmDialog(`确定删除渠道组「${g.name}」？引用它的路由将失效。`, { danger: true });
          if (!yes) return;
          try {
            await H.api(`/api/groups/${encodeURIComponent(g.name)}`, { method: 'DELETE' });
            H.toast('已删除', 'ok');
            renderChannelsGroups(box, channels);
          } catch (e) { H.toast(e.message, 'err'); }
        });
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      tableBox.appendChild(table);
      panel.appendChild(tableBox);
    }).catch((e) => { panel.appendChild(H.el('div', { class: 'callout callout-err', text: e.message })); });

    box.appendChild(panel);
    addBtn.addEventListener('click', () => addGroup(channels, box));

    function renderChannelsGroups(b, chs) {
      // 重新加载当前视图
      renderRoutes(b, null, chs);
    }
  }

  function groupForm(channels, existing) {
    const div = H.el('div');
    const nameRow = H.el('div', { class: 'field' });
    nameRow.appendChild(H.el('label', { text: '组名' }));
    nameRow.appendChild(H.el('input', {
      type: 'text', id: 'gr-name', placeholder: '如 oncall', class: 'mono',
      value: existing ? existing.name : '', disabled: existing ? 'disabled' : null,
    }));
    div.appendChild(nameRow);

    const chBox = H.el('div', { class: 'field' });
    chBox.appendChild(H.el('label', { text: '包含渠道' }));
    const list = H.el('div', { style: 'max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px;' });
    for (const ch of channels) {
      const lab = H.el('label', { style: 'display:flex;align-items:center;gap:6px;font-weight:400;font-size:var(--fs-s);cursor:pointer;' });
      const cb = H.el('input', { type: 'checkbox', value: ch.id });
      if (existing && (existing.channels || []).includes(ch.id)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(`${ch.name || ch.type}`));
      list.appendChild(lab);
    }
    chBox.appendChild(list);
    div.appendChild(chBox);

    return {
      div,
      getValue() {
        return {
          name: document.getElementById('gr-name').value.trim(),
          channels: Array.from(list.querySelectorAll('input:checked')).map((c) => c.value),
        };
      },
    };
  }

  function addGroup(channels, box) {
    const form = groupForm(channels, null);
    const foot = H.el('div', { class: 'modal-foot' });
    const cancel = H.el('button', { class: 'btn', text: '取消' });
    const save = H.el('button', { class: 'btn btn-primary', text: '保存' });
    foot.appendChild(cancel);
    foot.appendChild(save);
    const m = H.openModal({ title: '新建渠道组', content: form.div, footer: foot });
    cancel.addEventListener('click', m.close);
    save.addEventListener('click', async () => {
      const val = form.getValue();
      if (!val.name) { H.toast('请填写组名', 'err'); return; }
      save.disabled = true;
      try {
        await H.api('/api/groups', { method: 'POST', body: val });
        H.toast('渠道组已创建', 'ok');
        m.close();
        renderRoutes(currentBox, null, channels);
      } catch (e) { H.toast(e.message, 'err'); save.disabled = false; }
    });
  }

  function editGroup(g, channels) {
    const form = groupForm(channels, g);
    const foot = H.el('div', { class: 'modal-foot' });
    const cancel = H.el('button', { class: 'btn', text: '取消' });
    const save = H.el('button', { class: 'btn btn-primary', text: '保存' });
    foot.appendChild(cancel);
    foot.appendChild(save);
    const m = H.openModal({ title: `编辑渠道组 · ${g.name}`, content: form.div, footer: foot });
    cancel.addEventListener('click', m.close);
    save.addEventListener('click', async () => {
      const val = form.getValue();
      save.disabled = true;
      try {
        await H.api(`/api/groups/${encodeURIComponent(g.name)}`, { method: 'PUT', body: val });
        H.toast('已保存', 'ok');
        m.close();
        renderRoutes(currentBox, null, channels);
      } catch (e) { H.toast(e.message, 'err'); save.disabled = false; }
    });
  }

  // 主渲染
  async function renderRoutes(box, _ctx, presetChannels) {
    currentBox = box;
    box.innerHTML = '';
    const data = await loadData();
    if (presetChannels) data.channels = presetChannels;

    // ---- 路由列表 ----
    const wrap = H.el('div', { class: 'panel' });
    const head = H.el('div', { class: 'panel-head' });
    const titleBox = H.el('div');
    titleBox.appendChild(H.el('h2', { class: 'panel-title', text: '路由与分发' }));
    titleBox.appendChild(H.el('div', {
      class: 'panel-desc',
      text: '每条路由定义「什么消息 → 发到哪些渠道」。并行分发 + 可配置降级链。',
    }));
    head.appendChild(titleBox);
    const addBtn = H.el('button', { class: 'btn btn-primary', text: '+ 新增路由' });
    head.appendChild(addBtn);
    wrap.appendChild(head);

    if (!data.routes.length) {
      const empty = H.el('div', { class: 'empty' });
      empty.appendChild(H.el('p', { text: '还没有路由。未匹配任何路由的消息会发到「全局设置 → 默认兜底渠道」。' }));
      wrap.appendChild(empty);
    } else {
      const tableBox = H.el('div', { class: 'table-wrap' });
      const table = H.el('table');
      const thead = H.el('thead');
      const trh = H.el('tr');
      ['名称', '匹配条件', '目标', '优先级', '状态', '操作'].forEach((t) => trh.appendChild(H.el('th', { text: t })));
      thead.appendChild(trh);
      table.appendChild(thead);
      const tbody = H.el('tbody');

      for (const r of data.routes) {
        const w = r.when || {};
        const condParts = [];
        if (w.channel) condParts.push(`channel=${w.channel}`);
        if (w.level) condParts.push(`level=${w.level}`);
        if (w.tags && w.tags.length) condParts.push(`tags=${w.tags.join(',')}`);
        if (w.data && w.data.key) condParts.push(`${w.data.key}=${w.data.value}`);
        const cond = condParts.length ? condParts.join(' 且 ') : '匹配所有';

        const targets = (r.targets || []).map((t) => {
          if (t.startsWith('group:')) return `<span class="badge badge-info">${t}</span>`;
          const ch = data.channels.find((c) => `channel:${c.id}` === t);
          return ch ? (ch.name || ch.type) : t.replace(/^channel:/, '');
        });
        const failoverText = (r.failover || []).length
          ? (r.failover || []).map((t) => t.replace(/^(channel:|group:)/, '')).join(', ')
          : '无';

        const tr = H.el('tr');
        tr.appendChild(H.el('td', { text: r.name || r.id, style: 'font-weight:600;' }));
        tr.appendChild(H.el('td', { text: cond, style: 'font-size:var(--fs-s);color:var(--text-2);' }));
        const tdT = H.el('td', { style: 'max-width:220px;' });
        tdT.innerHTML = targets.join(' · ') || '—';
        if ((r.failover || []).length) {
          tdT.appendChild(H.el('div', {
            class: 'field-hint', text: `降级 → ${failoverText}`,
          }));
        }
        tr.appendChild(tdT);
        tr.appendChild(H.el('td', { text: r.priority || 0, style: 'text-align:center;' }));
        const st = H.el('td');
        st.appendChild(H.el('span', {
          class: 'badge ' + (r.enabled ? 'badge-ok' : 'badge-off'),
          text: r.enabled ? '启用' : '停用',
        }));
        tr.appendChild(st);
        const act = H.el('td', { class: 'actions' });
        const btnEdit = H.el('button', { class: 'btn btn-sm', text: '编辑' });
        const btnToggle = H.el('button', { class: 'btn btn-sm', text: r.enabled ? '停用' : '启用' });
        const btnDel = H.el('button', { class: 'btn btn-sm btn-danger', text: '删除' });
        act.appendChild(btnEdit);
        act.appendChild(btnToggle);
        act.appendChild(btnDel);
        tr.appendChild(act);

        btnEdit.addEventListener('click', () => editRoute(r, data));
        btnToggle.addEventListener('click', async () => {
          try {
            await H.api(`/api/routes/${r.id}`, { method: 'PUT', body: { enabled: !r.enabled } });
            H.toast('已更新', 'ok');
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

        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      tableBox.appendChild(table);
      wrap.appendChild(tableBox);
    }

    box.appendChild(wrap);
    addBtn.addEventListener('click', () => addRoute(data));

    // ---- 渠道组管理 ----
    renderGroupsUI(box, data.channels);
  }

  function addRoute(data) {
    const form = routeForm(data, null);
    const foot = H.el('div', { class: 'modal-foot' });
    const cancel = H.el('button', { class: 'btn', text: '取消' });
    const save = H.el('button', { class: 'btn btn-primary', text: '保存' });
    foot.appendChild(cancel);
    foot.appendChild(save);
    const m = H.openModal({ title: '新增路由', content: form.div, footer: foot, large: true });
    form.afterMount();
    cancel.addEventListener('click', m.close);
    save.addEventListener('click', async () => {
      const val = form.getValue();
      if (!val.targets.length) { H.toast('请至少选择一个目标渠道或渠道组', 'err'); return; }
      save.disabled = true;
      try {
        await H.api('/api/routes', { method: 'POST', body: val });
        H.toast('路由已创建', 'ok');
        m.close();
        renderRoutes(currentBox);
      } catch (e) { H.toast(e.message, 'err'); save.disabled = false; }
    });
  }

  function editRoute(r, data) {
    const form = routeForm(data, r);
    const foot = H.el('div', { class: 'modal-foot' });
    const cancel = H.el('button', { class: 'btn', text: '取消' });
    const save = H.el('button', { class: 'btn btn-primary', text: '保存' });
    foot.appendChild(cancel);
    foot.appendChild(save);
    const m = H.openModal({ title: `编辑路由 · ${r.name || r.id}`, content: form.div, footer: foot, large: true });
    form.afterMount();
    cancel.addEventListener('click', m.close);
    save.addEventListener('click', async () => {
      const val = form.getValue();
      save.disabled = true;
      try {
        await H.api(`/api/routes/${r.id}`, { method: 'PUT', body: val });
        H.toast('已保存', 'ok');
        m.close();
        renderRoutes(currentBox);
      } catch (e) { H.toast(e.message, 'err'); save.disabled = false; }
    });
  }

  window.HookHubViews = window.HookHubViews || {};
  window.HookHubViews.routes = { render: (box) => renderRoutes(box) };
})();