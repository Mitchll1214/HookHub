// 令牌管理视图：列表 / 生成 / 复制 / 禁用 / 白名单 / 删除
// 依赖：common.js（HookHub）

(function () {
  const H = window.HookHub;
  let currentBox = null;

  async function loadData() {
    const [tokData, chData] = await Promise.all([
      H.api('/api/tokens'),
      H.api('/api/channels'),
    ]);
    return {
      tokens: tokData.tokens || [],
      channels: chData.channels || [],
    };
  }

  // datetime-local 需要本地时区的 YYYY-MM-DDTHH:mm
  function toLocalInput(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // 生成/编辑令牌共用的表单
  function tokenForm({ existing, channels } = {}) {
    const div = H.el('div');
    const nameRow = H.el('div', { class: 'field' });
    nameRow.appendChild(H.el('label', { text: '令牌名称' }));
    const nameInput = H.el('input', {
      type: 'text', placeholder: '如：CI 报警',
      value: existing ? existing.name || '' : '',
    });
    nameRow.appendChild(nameInput);
    div.appendChild(nameRow);

    const expRow = H.el('div', { class: 'field' });
    expRow.appendChild(H.el('label', { text: '过期时间（可选）' }));
    const expInput = H.el('input', {
      type: 'datetime-local',
      value: existing && existing.expiresAt ? toLocalInput(existing.expiresAt) : '',
    });
    expRow.appendChild(expInput);
    expRow.appendChild(H.el('div', { class: 'field-hint', text: '留空表示永不过期。' }));
    div.appendChild(expRow);

    const wlRow = H.el('div', { class: 'field' });
    wlRow.appendChild(H.el('label', { text: '渠道白名单（留空 = 全部可用）' }));
    const wlBox = H.el('div', { class: 'check-list', style: 'max-height:200px;' });
    if (!channels.length) {
      wlBox.appendChild(H.el('p', { class: 'field-hint', text: '还没有渠道，请先在「渠道管理」添加。' }));
    }
    const selected = (existing && existing.allowedChannels) || [];
    for (const ch of channels) {
      const lab = H.el('label', { class: 'check-item' });
      const cb = H.el('input', { type: 'checkbox', value: ch.id });
      if (selected.includes(ch.id) || selected.includes('*')) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(ch.name || ch.type));
      wlBox.appendChild(lab);
    }
    wlRow.appendChild(wlBox);
    div.appendChild(wlRow);

    return {
      div,
      getValue() {
        const checked = wlBox.querySelectorAll('input[type=checkbox]:checked');
        return {
          name: nameInput.value.trim(),
          expiresAt: expInput.value ? new Date(expInput.value).toISOString() : null,
          allowedChannels: Array.from(checked).map((c) => c.value),
        };
      },
    };
  }

  function tokenUrl(tk) {
    return `${location.origin}/hook/${tk.token}`;
  }

  async function renderTokens(box) {
    currentBox = box;
    box.innerHTML = ''; // 清掉骨架屏，避免刷新时内容叠加
    const { tokens, channels } = await loadData();

    box.appendChild(H.pageHead({
      kicker: 'Tokens',
      title: '令牌管理',
      desc: '每个令牌对应一个 /hook/令牌 入口地址。调用方只需知道令牌即可发消息，可按需限制可用渠道与有效期。',
      actions: H.primaryAction('生成令牌', () => addToken(channels)),
    }));

    if (!tokens.length) {
      box.appendChild(H.emptyState({
        iconName: 'key',
        title: '还没有任何令牌',
        desc: '令牌是外部服务调用你的唯一凭据。生成后复制 Webhook 地址，即可用一次 HTTP 请求向多个渠道推送。',
        action: H.primaryAction('生成第一个令牌', () => addToken(channels)),
      }));
      return;
    }

    const now = Date.now();
    const activeCount = tokens.filter((t) => {
      if (t.enabled === false) return false;
      const exp = t.expiresAt ? new Date(t.expiresAt).getTime() : NaN;
      return Number.isNaN(exp) || exp > now;
    }).length;

    const panel = H.el('div', { class: 'panel', style: 'padding:0;' });
    panel.appendChild(H.el('div', { class: 'list-bar' }, [
      H.el('span', { class: 'list-bar-title', text: `共 ${tokens.length} 个令牌` }),
      H.el('span', { class: 'list-bar-meta', text: `${activeCount} 个可用 · ${tokens.length - activeCount} 个停用/过期` }),
    ]));

    const tableBox = H.el('div', { class: 'table-wrap', style: 'border:0;border-radius:0;' });
    const table = H.el('table');
    const thead = H.el('thead');
    const trh = H.el('tr');
    ['名称', '令牌（Webhook 地址）', '白名单', '状态', '创建时间', '操作'].forEach((t, i) => {
      trh.appendChild(H.el('th', { text: t, class: i === 5 ? 'th-actions' : null }));
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = H.el('tbody');

    for (const tk of tokens) {
      const base = tokenUrl(tk);
      const tr = H.el('tr');
      tr.appendChild(H.el('td', { text: tk.name || '未命名', style: 'font-weight:600;color:var(--text);white-space:nowrap;' }));

      // 令牌地址 + 复制按钮
      const tdTok = H.el('td', { class: 'cell-url' });
      const tokWrap = H.el('div', { class: 'copy-row' });
      const inp = H.el('input', {
        type: 'text', readonly: '', value: base, class: 'mono',
        'aria-label': `${tk.name || '令牌'} 的 Webhook 地址`,
      });
      const copyBtn = H.el('button', { class: 'btn btn-sm', text: '复制', type: 'button' });
      tokWrap.appendChild(inp);
      tokWrap.appendChild(copyBtn);
      tdTok.appendChild(tokWrap);
      tr.appendChild(tdTok);

      copyBtn.addEventListener('click', () => H.copyText(base, inp));

      // 白名单
      const wl = (tk.allowedChannels || []).filter((c) => c !== '*');
      tr.appendChild(H.el('td', {
        text: wl.length ? wl.map((id) => {
          const ch = channels.find((c) => c.id === id);
          return ch ? (ch.name || ch.type) : id;
        }).join('、') : '全部渠道',
        class: 'cell-summary',
      }));

      // 状态
      const st = H.el('td');
      const expired = tk.expiresAt && new Date(tk.expiresAt).getTime() < now;
      let badge;
      if (expired) badge = H.el('span', { class: 'badge badge-err', text: '已过期' });
      else badge = H.el('span', {
        class: 'badge ' + (tk.enabled ? 'badge-ok' : 'badge-off'),
        text: tk.enabled ? '启用' : '禁用',
      });
      st.appendChild(badge);
      tr.appendChild(st);

      tr.appendChild(H.el('td', { text: H.fmtTime(tk.createdAt), class: 'cell-time' }));

      const tdAct = H.el('td', { class: 'actions' });
      const btnEdit = H.el('button', { class: 'btn btn-sm', text: '编辑', type: 'button' });
      const btnToggle = H.el('button', { class: 'btn btn-sm', text: tk.enabled ? '禁用' : '启用', type: 'button' });
      const btnDel = H.el('button', { class: 'btn btn-sm btn-danger', text: '删除', type: 'button' });
      tdAct.appendChild(btnEdit);
      tdAct.appendChild(btnToggle);
      tdAct.appendChild(btnDel);
      tr.appendChild(tdAct);

      btnToggle.addEventListener('click', async () => {
        try {
          await H.api(`/api/tokens/${tk.token}`, { method: 'PUT', body: { enabled: !tk.enabled } });
          H.toast(tk.enabled ? '已禁用' : '已启用', 'ok');
          renderTokens(box);
        } catch (e) { H.toast(e.message, 'err'); }
      });
      btnDel.addEventListener('click', async () => {
        const yes = await H.confirmDialog(`确定删除令牌「${tk.name || tk.token}」？调用方将无法再使用该地址。`, { danger: true });
        if (!yes) return;
        try {
          await H.api(`/api/tokens/${tk.token}`, { method: 'DELETE' });
          H.toast('已删除', 'ok');
          renderTokens(box);
        } catch (e) { H.toast(e.message, 'err'); }
      });
      btnEdit.addEventListener('click', () => editToken(tk, channels));

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableBox.appendChild(table);
    panel.appendChild(tableBox);
    box.appendChild(panel);
  }

  function addToken(channels) {
    const form = tokenForm({ channels });
    H.formModal({
      title: '生成新令牌',
      content: form.div,
      submitText: '生成',
      onSubmit: async () => {
        const data = await H.api('/api/tokens', { method: 'POST', body: form.getValue() });
        H.toast('令牌已生成', 'ok');
        // 展示完整令牌（先弹结果，再刷新列表）
        showTokenResult(data.token);
        renderTokens(currentBox);
      },
    });
  }

  function editToken(tk, channels) {
    const form = tokenForm({ existing: tk, channels });
    H.formModal({
      title: `编辑令牌 · ${tk.name || tk.token}`,
      content: form.div,
      submitText: '保存',
      onSubmit: async () => {
        await H.api(`/api/tokens/${tk.token}`, { method: 'PUT', body: form.getValue() });
        H.toast('已保存', 'ok');
        renderTokens(currentBox);
      },
    });
  }

  // 生成成功后展示完整令牌地址
  function showTokenResult(tk) {
    const base = tokenUrl(tk);
    const content = H.el('div');
    content.appendChild(H.el('p', { text: '新令牌已创建，请立即复制保存（此后不再显示完整值）：' }));
    const row = H.el('div', { class: 'copy-row' });
    const inp = H.el('input', {
      type: 'text', readonly: '', value: base, class: 'mono', 'aria-label': '新令牌 Webhook 地址',
    });
    const copy = H.el('button', { class: 'btn btn-primary', text: '复制', type: 'button' });
    row.appendChild(inp);
    row.appendChild(copy);
    content.appendChild(row);
    H.openModal({ title: '令牌创建成功', content });
    copy.addEventListener('click', () => H.copyText(base, inp));
    setTimeout(() => inp.select(), 60);
  }

  window.HookHubViews = window.HookHubViews || {};
  window.HookHubViews.tokens = { render: async (box) => { await renderTokens(box); } };
})();