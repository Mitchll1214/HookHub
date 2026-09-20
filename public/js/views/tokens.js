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

  // 生成令牌表单
  function tokenForm() {
    const div = H.el('div');
    const nameRow = H.el('div', { class: 'field' });
    nameRow.appendChild(H.el('label', { text: '令牌名称' }));
    nameRow.appendChild(H.el('input', { type: 'text', id: 'tk-name', placeholder: '如：CI 报警' }));
    div.appendChild(nameRow);

    const expRow = H.el('div', { class: 'field' });
    expRow.appendChild(H.el('label', { text: '过期时间（可选）' }));
    expRow.appendChild(H.el('input', {
      type: 'datetime-local', id: 'tk-exp',
    }));
    div.appendChild(expRow);

    const wlRow = H.el('div', { class: 'field' });
    wlRow.appendChild(H.el('label', { text: '渠道白名单（留空 = 全部可用）' }));
    const wlBox = H.el('div', { id: 'tk-wl', style: 'display:flex;flex-wrap:wrap;gap:8px;max-height:200px;overflow-y:auto;' });
    wlRow.appendChild(wlBox);
    div.appendChild(wlRow);

    return {
      div,
      setChannels(channels) {
        wlBox.innerHTML = '';
        for (const ch of channels) {
          const lab = H.el('label', {
            style: 'display:inline-flex;align-items:center;gap:4px;font-weight:400;font-size:var(--fs-s);cursor:pointer;',
          });
          const cb = H.el('input', { type: 'checkbox', value: ch.id, 'data-tk-wl': ch.id });
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(`${ch.name || ch.type}`));
          wlBox.appendChild(lab);
        }
      },
      getValue() {
        const checked = wlBox.querySelectorAll('input[type=checkbox]:checked');
        return {
          name: document.getElementById('tk-name').value.trim(),
          expiresAt: document.getElementById('tk-exp').value
            ? new Date(document.getElementById('tk-exp').value).toISOString()
            : null,
          allowedChannels: Array.from(checked).map((c) => c.value),
        };
      },
    };
  }

  async function renderTokens(box) {
    currentBox = box;
    box.innerHTML = '';
    const { tokens, channels } = await loadData();

    const wrap = H.el('div', { class: 'panel' });
    const head = H.el('div', { class: 'panel-head' });
    const titleBox = H.el('div');
    titleBox.appendChild(H.el('h2', { class: 'panel-title', text: '令牌管理' }));
    titleBox.appendChild(H.el('div', {
      class: 'panel-desc',
      text: '每个令牌对应一个 /hook/令牌 入口地址。调用方只需知道令牌即可发消息。',
    }));
    head.appendChild(titleBox);
    const addBtn = H.el('button', { class: 'btn btn-primary', text: '+ 生成令牌' });
    head.appendChild(addBtn);
    wrap.appendChild(head);

    if (!tokens.length) {
      const empty = H.el('div', { class: 'empty' });
      empty.appendChild(H.el('div', { text: '🔑', class: 'big' }));
      empty.appendChild(H.el('p', { text: '还没有令牌，点击「生成令牌」创建一个 webhook 地址。' }));
      wrap.appendChild(empty);
    } else {
      const tableBox = H.el('div', { class: 'table-wrap' });
      const table = H.el('table');
      const thead = H.el('thead');
      const trh = H.el('tr');
      ['名称', '令牌（Webhook 地址）', '白名单', '状态', '创建时间', '操作'].forEach((t) => trh.appendChild(H.el('th', { text: t })));
      thead.appendChild(trh);
      table.appendChild(thead);
      const tbody = H.el('tbody');

      for (const tk of tokens) {
        const base = `${location.origin}/hook/${tk.token}`;
        const tr = H.el('tr');
        tr.appendChild(H.el('td', { text: tk.name || '未命名' }));

        // 令牌地址 + 复制按钮
        const tdTok = H.el('td');
        const tokWrap = H.el('div', { style: 'display:flex;gap:6px;align-items:center;width:100%;' });
        const inp = H.el('input', {
          type: 'text', readonly: '', value: base, class: 'mono', style: 'font-size:var(--fs-xs);flex:1;min-width:0;width:auto;',
        });
        const copyBtn = H.el('button', { class: 'btn btn-sm', text: '复制' });
        tokWrap.appendChild(inp);
        tokWrap.appendChild(copyBtn);
        tdTok.appendChild(tokWrap);
        tr.appendChild(tdTok);

        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(base);
            H.toast('已复制 Webhook 地址', 'ok');
          } catch {
            inp.select();
            document.execCommand('copy');
            H.toast('已复制（兼容模式）', 'ok');
          }
        });

        // 白名单
        const wl = (tk.allowedChannels || []).filter((c) => c !== '*');
        tr.appendChild(H.el('td', {
          text: wl.length ? wl.map((id) => {
            const ch = channels.find((c) => c.id === id);
            return ch ? (ch.name || ch.type) : id;
          }).join(', ') : '全部渠道',
          style: 'max-width:200px;font-size:var(--fs-s);color:var(--text-2);',
        }));

        // 状态
        const st = H.el('td');
        const expired = tk.expiresAt && new Date(tk.expiresAt).getTime() < Date.now();
        let badge;
        if (expired) badge = H.el('span', { class: 'badge badge-err', text: '已过期' });
        else badge = H.el('span', {
          class: 'badge ' + (tk.enabled ? 'badge-ok' : 'badge-off'),
          text: tk.enabled ? '启用' : '禁用',
        });
        st.appendChild(badge);
        tr.appendChild(st);

        tr.appendChild(H.el('td', { text: H.fmtTime(tk.createdAt), style: 'font-size:var(--fs-s);color:var(--text-3);white-space:nowrap;' }));

        const tdAct = H.el('td', { class: 'actions' });
        const btnEdit = H.el('button', { class: 'btn btn-sm', text: '编辑' });
        const btnToggle = H.el('button', { class: 'btn btn-sm', text: tk.enabled ? '禁用' : '启用' });
        const btnDel = H.el('button', { class: 'btn btn-sm btn-danger', text: '删除' });
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
      wrap.appendChild(tableBox);
    }

    box.appendChild(wrap);
    addBtn.addEventListener('click', () => addToken(channels));
  }

  function addToken(channels) {
    const form = tokenForm();
    form.setChannels(channels);
    const foot = H.el('div', { class: 'modal-foot' });
    const cancel = H.el('button', { class: 'btn', text: '取消' });
    const save = H.el('button', { class: 'btn btn-primary', text: '生成' });
    foot.appendChild(cancel);
    foot.appendChild(save);
    const m = H.openModal({ title: '生成新令牌', content: form.div, footer: foot });
    cancel.addEventListener('click', m.close);
    save.addEventListener('click', async () => {
      const val = form.getValue();
      save.disabled = true;
      try {
        const data = await H.api('/api/tokens', { method: 'POST', body: val });
        H.toast('令牌已生成', 'ok');
        m.close();
        // 展示完整令牌
        showTokenResult(data.token, channels);
        renderTokens(currentBox);
      } catch (e) { H.toast(e.message, 'err'); save.disabled = false; }
    });
  }

  function editToken(tk, channels) {
    const form = tokenForm();
    form.setChannels(channels);
    // 回填
    document.getElementById('tk-name').value = tk.name || '';
    if (tk.expiresAt) {
      const d = new Date(tk.expiresAt);
      const p = (n) => String(n).padStart(2, '0');
      document.getElementById('tk-exp').value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    form.div.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      if ((tk.allowedChannels || []).includes(cb.value)) cb.checked = true;
    });
    const foot = H.el('div', { class: 'modal-foot' });
    const cancel = H.el('button', { class: 'btn', text: '取消' });
    const save = H.el('button', { class: 'btn btn-primary', text: '保存' });
    foot.appendChild(cancel);
    foot.appendChild(save);
    const m = H.openModal({ title: `编辑令牌 · ${tk.name || tk.token}`, content: form.div, footer: foot });
    cancel.addEventListener('click', m.close);
    save.addEventListener('click', async () => {
      const val = form.getValue();
      save.disabled = true;
      try {
        await H.api(`/api/tokens/${tk.token}`, { method: 'PUT', body: val });
        H.toast('已保存', 'ok');
        m.close();
        renderTokens(currentBox);
      } catch (e) { H.toast(e.message, 'err'); save.disabled = false; }
    });
  }

  // 生成成功后展示完整令牌地址
  function showTokenResult(tk) {
    const base = `${location.origin}/hook/${tk.token}`;
    const content = H.el('div');
    content.appendChild(H.el('p', { text: '新令牌已创建，请立即复制保存（此后不再显示完整值）：' }));
    const box = H.el('div', { style: 'display:flex;gap:6px;align-items:center;width:100%;min-width:0;' });
    const inp = H.el('input', { type: 'text', readonly: '', value: base, class: 'mono', style: 'flex:1;min-width:0;width:auto;font-size:var(--fs-xs);' });
    const copy = H.el('button', { class: 'btn btn-primary', style: 'white-space:nowrap;', text: '复制' });
    box.appendChild(inp);
    box.appendChild(copy);
    content.appendChild(box);
    const m = H.openModal({ title: '令牌创建成功', content });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(base); H.toast('已复制', 'ok'); }
      catch { inp.select(); document.execCommand('copy'); H.toast('已复制（兼容模式）', 'ok'); }
    });
  }

  window.HookHubViews = window.HookHubViews || {};
  window.HookHubViews.tokens = { render: (box) => renderTokens(box) };
})();