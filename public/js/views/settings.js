// 全局设置视图：默认兜底渠道 / CORS / 签名开关 / 导入导出 / 初始化
// 依赖：common.js（HookHub）

(function () {
  const H = window.HookHub;
  let currentBox = null;

  async function renderSettings(box) {
    currentBox = box;
    box.innerHTML = '';

    const [settingsData, chData, groupsData] = await Promise.all([
      H.api('/api/settings'),
      H.api('/api/channels'),
      H.api('/api/groups'),
    ]);
    const settings = settingsData.settings || {};
    const channels = chData.channels || [];
    const groups = groupsData.groups || [];

    // ---- 初始化状态 ----
    const initPanel = H.el('div', { class: 'panel' });
    const initHead = H.el('div', { class: 'panel-head' });
    initHead.appendChild(H.el('h2', { class: 'panel-title', text: '全局设置' }));
    initPanel.appendChild(initHead);

    const initialized = !!settings.createdAt;
    if (!initialized) {
      const warn = H.el('div', { class: 'callout callout-warn' });
      warn.appendChild(H.el('strong', { text: '系统尚未初始化。' }));
      warn.appendChild(document.createTextNode(' 点击下方按钮写入默认配置（只消耗 1 次 KV 写入）。'));
      initPanel.appendChild(warn);
      const initBtn = H.el('button', { class: 'btn btn-accent', text: '初始化系统' });
      initPanel.appendChild(initBtn);
      initBtn.addEventListener('click', async () => {
        try {
          const data = await H.api('/api/settings', { method: 'POST', body: { settings: {} } });
          H.toast('系统已初始化，默认路由已创建', 'ok');
          // 同步顶部「未初始化」徽章状态（隐藏 + 更新全局标记）
          const badge = document.getElementById('initBadge');
          if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
          window.__hookhubInitialized = true;
          renderSettings(box);
        } catch (e) { H.toast(e.message, 'err'); }
      });
    } else {
      initPanel.appendChild(H.el('p', {
        class: 'field-hint', text: `已初始化 · schemaVersion ${settings.schemaVersion || 1} · 创建于 ${H.fmtTime(settings.createdAt)}`,
      }));
    }
    box.appendChild(initPanel);

    const wrap = H.el('div', { class: 'panel' });
    const head = H.el('div', { class: 'panel-head' });
    const titleBox = H.el('div');
    titleBox.appendChild(H.el('h2', { class: 'panel-title', text: '默认兜底与限流' }));
    head.appendChild(titleBox);
    wrap.appendChild(head);

    // ---- 默认兜底渠道 ----
    const defRow = H.el('div', { class: 'field' });
    defRow.appendChild(H.el('label', { text: '默认兜底渠道（未匹配任何路由时发送到）' }));
    defRow.appendChild(H.el('p', {
      class: 'field-hint', style: 'margin-bottom:var(--sp-2);',
      text: '可多选渠道与渠道组。留空 = 未匹配路由的消息不发送。',
    }));
    const defBox = H.el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:10px;' });
    const defSelected = (settings.defaultChannels || []).map((c) => (c.startsWith('channel:') ? c : `channel:${c}`));
    for (const ch of channels) {
      const lab = H.el('label', { style: 'display:flex;align-items:center;gap:6px;font-weight:400;font-size:var(--fs-s);cursor:pointer;width:48%;' });
      const cb = H.el('input', { type: 'checkbox', value: `channel:${ch.id}`, 'data-def': '1' });
      if (defSelected.includes(`channel:${ch.id}`)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(`${ch.name || ch.type}`));
      defBox.appendChild(lab);
    }
    for (const g of groups) {
      const lab = H.el('label', { style: 'display:flex;align-items:center;gap:6px;font-weight:400;font-size:var(--fs-s);cursor:pointer;width:48%;' });
      const cb = H.el('input', { type: 'checkbox', value: `group:${g.name}`, 'data-def': '1' });
      if (defSelected.includes(`group:${g.name}`)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(`组: ${g.name}`));
      defBox.appendChild(lab);
    }
    defRow.appendChild(defBox);
    wrap.appendChild(defRow);

    // ---- 超时与重试 ----
    const grid = H.el('div', { class: 'form-grid' });
    const tRow = H.el('div', { class: 'field' });
    tRow.appendChild(H.el('label', { text: '渠道请求超时（毫秒）' }));
    tRow.appendChild(H.el('input', { type: 'number', id: 'st-timeout', value: settings.timeoutMs || 8000, min: 1000, max: 30000, step: 500 }));
    grid.appendChild(tRow);
    const rRow = H.el('div', { class: 'field' });
    rRow.appendChild(H.el('label', { text: '重试次数（不含首次）' }));
    rRow.appendChild(H.el('input', { type: 'number', id: 'st-retries', value: settings.retries != null ? settings.retries : 2, min: 0, max: 5 }));
    grid.appendChild(rRow);
    wrap.appendChild(grid);

    // ---- CORS ----
    const corsPanel = H.el('div', { class: 'panel', style: 'margin-top:var(--sp-4);' });
    corsPanel.appendChild(H.el('h3', { class: 'panel-title', text: 'CORS', style: 'font-size:var(--fs-l);' }));
    const corsAllowAll = H.el('div', { class: 'field' });
    const labAll = H.el('label', { style: 'display:flex;align-items:center;gap:6px;font-weight:400;' });
    const cbAll = H.el('input', { type: 'checkbox', id: 'st-cors-all' });
    if (settings.cors && settings.cors.allowAll !== false) cbAll.checked = true;
    labAll.appendChild(cbAll);
    labAll.appendChild(document.createTextNode('允许所有来源（默认）'));
    corsAllowAll.appendChild(labAll);
    corsPanel.appendChild(corsAllowAll);

    const corsList = H.el('div', { class: 'field' });
    corsList.appendChild(H.el('label', { text: '白名单来源（逗号分隔，取消上方勾选后生效）' }));
    corsList.appendChild(H.el('input', {
      type: 'text', id: 'st-cors-origins', class: 'mono',
      value: ((settings.cors && settings.cors.origins) || []).join(', '),
      placeholder: 'https://admin.example.com, https://app.example.com',
    }));
    corsPanel.appendChild(corsList);
    wrap.appendChild(corsPanel);

    // ---- 签名 ----
    const sigPanel = H.el('div', { class: 'panel', style: 'margin-top:var(--sp-4);' });
    sigPanel.appendChild(H.el('h3', { class: 'panel-title', text: '请求签名校验', style: 'font-size:var(--fs-l);' }));
    sigPanel.appendChild(H.el('p', {
      class: 'field-hint',
      text: '开启后，调用 /hook/令牌 必须携带 X-Signature 与 X-Timestamp 头。需要先在 Cloudflare 配置 SIGN_SECRET 环境变量。',
    }));
    const sigRow = H.el('div', { class: 'field' });
    const labSig = H.el('label', { style: 'display:flex;align-items:center;gap:6px;font-weight:400;' });
    const cbSig = H.el('input', { type: 'checkbox', id: 'st-sig-enabled' });
    if (settings.signature && settings.signature.enabled) cbSig.checked = true;
    labSig.appendChild(cbSig);
    labSig.appendChild(document.createTextNode('启用 X-Signature HMAC 校验'));
    sigRow.appendChild(labSig);
    sigPanel.appendChild(sigRow);
    wrap.appendChild(sigPanel);

    // 保存
    const saveBtn = H.el('button', { class: 'btn btn-primary', text: '保存全局设置', style: 'margin-top:var(--sp-4);' });
    wrap.appendChild(saveBtn);
    saveBtn.addEventListener('click', async () => {
      const body = {
        timeoutMs: Number(document.getElementById('st-timeout').value) || 8000,
        retries: Number(document.getElementById('st-retries').value) || 0,
        defaultChannels: Array.from(defBox.querySelectorAll('input[type=checkbox]:checked')).map((c) => c.value),
        cors: {
          allowAll: document.getElementById('st-cors-all').checked,
          origins: document.getElementById('st-cors-origins').value.split(',').map((s) => s.trim()).filter(Boolean),
        },
        signature: {
          enabled: document.getElementById('st-sig-enabled').checked,
        },
      };
      saveBtn.disabled = true;
      try {
        await H.api('/api/settings', { method: 'PUT', body });
        H.toast('全局设置已保存', 'ok');
      } catch (e) { H.toast(e.message, 'err'); }
      saveBtn.disabled = false;
    });
    box.appendChild(wrap);

    // ---- 备份与恢复 ----
    const bakPanel = H.el('div', { class: 'panel' });
    bakPanel.appendChild(H.el('h2', { class: 'panel-title', text: '备份与恢复' }));
    bakPanel.appendChild(H.el('p', {
      class: 'field-hint', text: '导出全部配置为 JSON 文件（不消耗 KV 写）；导入时一次性批量写入。',
    }));

    const btnExport = H.el('button', { class: 'btn', text: '导出全部配置' });
    const btnImport = H.el('button', { class: 'btn', text: '导入 JSON 恢复' });
    const btnCopy = H.el('button', { class: 'btn btn-sm btn-ghost', text: '复制 Webhook 地址', style: 'margin-left:8px;' });
    bakPanel.appendChild(btnExport);
    bakPanel.appendChild(btnImport);
    box.appendChild(bakPanel);

    // Webhook 地址卡片（取第一个启用令牌）
    try {
      const tokData = await H.api('/api/tokens');
      const tokens = tokData.tokens || [];
      const first = tokens.find((t) => t.enabled) || tokens[0];
      if (first) {
        const card = H.el('div', { class: 'panel' });
        card.appendChild(H.el('h3', { class: 'panel-title', text: 'Webhook 地址', style: 'font-size:var(--fs-l);' }));
        const url = `${location.origin}/hook/${first.token}`;
        const row = H.el('div', { style: 'display:flex;gap:8px;align-items:center;' });
        const inp = H.el('input', { type: 'text', readonly: '', value: url, class: 'mono' });
        const copyBtn = H.el('button', { class: 'btn btn-sm', text: '复制' });
        row.appendChild(inp);
        row.appendChild(copyBtn);
        card.appendChild(row);
        card.appendChild(H.el('p', {
          class: 'field-hint', text: 'curl 示例:',
          style: 'margin-top:var(--sp-2);',
        }));
        const curl = H.el('pre', {
          text: `curl -X POST ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Hello","body":"World","level":"info"}'`,
          style: 'margin-top:4px;',
        });
        card.appendChild(curl);
        box.appendChild(card);
        copyBtn.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(url); H.toast('已复制', 'ok'); }
          catch { inp.select(); document.execCommand('copy'); H.toast('已复制（兼容模式）', 'ok'); }
        });
      }
    } catch { /* 无令牌忽略 */ }

    // 导出
    btnExport.addEventListener('click', async () => {
      try {
        const data = await H.api('/api/config/export');
        const blob = new Blob([JSON.stringify({ config: data.config }, null, 2)], { type: 'application/json' });
        const a = H.el('a', { href: URL.createObjectURL(blob), download: `hookhub-config-${new Date().toISOString().slice(0, 10)}.json` });
        document.body.appendChild(a);
        a.click();
        a.remove();
        H.toast('已导出配置文件', 'ok');
      } catch (e) { H.toast('导出失败: ' + e.message, 'err'); }
    });

    // 导入
    btnImport.addEventListener('click', () => {
      const fileInput = H.el('input', { type: 'file', accept: '.json,application/json', class: 'file-input-hidden' });
      document.body.appendChild(fileInput);
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!data.config) throw new Error('文件缺少 config 字段');
          const yes = await H.confirmDialog('导入将覆盖同名配置（渠道/令牌/路由/渠道组/全局设置）。确定继续？', { danger: true });
          if (!yes) return;
          const res = await H.api('/api/config/import', { method: 'POST', body: data });
          H.toast(`导入完成：${res.imported} 条配置已写入${res.skipped ? `，跳过 ${res.skipped} 条` : ''}`, 'ok');
          renderSettings(box);
        } catch (e) {
          H.toast('导入失败: ' + e.message, 'err');
        } finally {
          fileInput.remove();
        }
      });
      fileInput.click();
    });
  }

  window.HookHubViews = window.HookHubViews || {};
  window.HookHubViews.settings = { render: (box) => renderSettings(box) };
})();