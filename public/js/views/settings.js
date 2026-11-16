// 全局设置视图：默认兜底渠道 / CORS / 签名开关 / 导入导出 / 初始化
// 依赖：common.js（HookHub）

(function () {
  const H = window.HookHub;

  // 分区：标题 + 说明 + 内容（替代 panel 套 panel）
  function section(title, desc, children) {
    const box = H.el('div', { class: 'form-section' });
    if (title) box.appendChild(H.el('h4', { text: title }));
    if (desc) box.appendChild(H.el('p', { class: 'field-hint', text: desc }));
    for (const c of [].concat(children || [])) if (c) box.appendChild(c);
    return box;
  }

  // 复选框行（标签 + 说明）
  function checkRow(input, label, hint) {
    const wrap = H.el('div', { class: 'field', style: 'margin-bottom:0;' });
    const lab = H.el('label', { class: 'check-item', style: 'padding:4px 0;' });
    lab.appendChild(input);
    lab.appendChild(H.el('span', { text: label }));
    wrap.appendChild(lab);
    if (hint) wrap.appendChild(H.el('p', { class: 'field-hint', style: 'margin:2px 0 0 23px;', text: hint }));
    return wrap;
  }

  async function renderSettings(box) {
    currentBox = box;
    box.innerHTML = '';

    const [settingsData, chData, groupsData, tokData] = await Promise.all([
      H.api('/api/settings'),
      H.api('/api/channels'),
      H.api('/api/groups').catch(() => ({ groups: [] })),
      H.api('/api/tokens').catch(() => ({ tokens: [] })),
    ]);
    const settings = settingsData.settings || {};
    const channels = chData.channels || [];
    const groups = groupsData.groups || [];
    const tokens = tokData.tokens || [];

    box.appendChild(H.pageHead({
      kicker: 'Settings',
      title: '全局设置',
      desc: '兜底渠道、超时重试、CORS 与签名校验；以及配置的备份与恢复。',
    }));

    // ---- 初始化状态 ----
    const initialized = !!settings.createdAt;
    if (!initialized) {
      const warn = H.el('div', { class: 'callout callout-warn' });
      warn.appendChild(H.el('strong', { text: '系统尚未初始化。' }));
      warn.appendChild(document.createTextNode(' 点击右侧按钮写入默认配置（只消耗 1 次 KV 写入），并创建示例路由。'));
      const initBtn = H.el('button', { class: 'btn btn-sm btn-accent', text: '初始化系统', style: 'margin-left:var(--sp-3);' });
      warn.appendChild(initBtn);
      box.appendChild(warn);

      initBtn.addEventListener('click', async () => {
        initBtn.disabled = true;
        initBtn.textContent = '初始化中…';
        try {
          await H.api('/api/settings', { method: 'POST', body: { settings: {} } });
          H.toast('系统已初始化，默认路由已创建', 'ok');
          H.state.initialized = true;
          // 顶栏徽章由 [hidden] 控制显隐，避免 style.display 与 CSS 打架
          const badge = document.getElementById('initBadge');
          if (badge) badge.hidden = true;
          renderSettings(box);
        } catch (e) {
          H.toast(e.message, 'err');
          initBtn.disabled = false;
          initBtn.textContent = '初始化系统';
        }
      });
    } else {
      const meta = H.el('div', { class: 'callout callout-ok', style: 'margin-bottom:var(--sp-4);' });
      meta.appendChild(H.el('strong', { text: '系统已初始化' }));
      meta.appendChild(document.createTextNode(
        ` · schemaVersion ${settings.schemaVersion || 1} · 创建于 ${H.fmtTime(settings.createdAt)}`
      ));
      box.appendChild(meta);
    }

    // ---- 默认兜底渠道与限流 ----
    const main = H.el('div', { class: 'panel' });

    const defField = H.el('div', { class: 'field' });
    defField.appendChild(H.el('label', { text: '默认兜底渠道' }));
    defField.appendChild(H.el('p', {
      class: 'field-hint', style: 'margin:0 0 var(--sp-2);',
      text: '未匹配任何路由时发送到这里。可多选渠道与渠道组；留空 = 未匹配路由的消息不发送。',
    }));
    const defList = H.el('div', { class: 'check-list', style: 'max-height:240px;' });
    const defSelected = (settings.defaultChannels || []).map((c) => (c.startsWith('channel:') || c.startsWith('group:') ? c : `channel:${c}`));
    if (!channels.length && !groups.length) {
      defList.appendChild(H.el('p', { class: 'field-hint', text: '还没有渠道或渠道组，请先在「渠道管理」添加。' }));
    }
    for (const ch of channels) {
      const lab = H.el('label', { class: 'check-item' });
      const cb = H.el('input', { type: 'checkbox', value: `channel:${ch.id}` });
      if (defSelected.includes(`channel:${ch.id}`)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(H.el('span', { text: ch.name || ch.type }));
      if (ch.enabled === false) lab.appendChild(H.el('span', { class: 'badge badge-off', text: '停用' }));
      defList.appendChild(lab);
    }
    for (const g of groups) {
      const lab = H.el('label', { class: 'check-item' });
      const cb = H.el('input', { type: 'checkbox', value: `group:${g.name}` });
      if (defSelected.includes(`group:${g.name}`)) cb.checked = true;
      lab.appendChild(cb);
      lab.appendChild(H.el('span', { text: `组：${g.name}`, style: 'font-family:var(--mono);' }));
      if (g.enabled === false) lab.appendChild(H.el('span', { class: 'badge badge-off', text: '停用' }));
      defList.appendChild(lab);
    }
    defField.appendChild(defList);
    main.appendChild(section('兜底与分发', null, [defField]));

    // ---- 超时与重试 ----
    const tField = H.el('div', { class: 'field', style: 'margin:0;' });
    tField.appendChild(H.el('label', { text: '渠道请求超时（毫秒）' }));
    const tInput = H.el('input', {
      type: 'number', value: settings.timeoutMs || 8000, min: 1000, max: 30000, step: 500,
    });
    tField.appendChild(tInput);
    const rField = H.el('div', { class: 'field', style: 'margin:0;' });
    rField.appendChild(H.el('label', { text: '重试次数（不含首次）' }));
    const rInput = H.el('input', {
      type: 'number', value: settings.retries != null ? settings.retries : 2, min: 0, max: 5,
    });
    rField.appendChild(rInput);
    main.appendChild(section('请求策略', null, [H.el('div', { class: 'form-grid' }, [tField, rField])]));

    // ---- CORS ----
    const cbAll = H.el('input', { type: 'checkbox' });
    if (!settings.cors || settings.cors.allowAll !== false) cbAll.checked = true;
    const allowAllRow = checkRow(cbAll, '允许所有来源（默认）');

    const originsField = H.el('div', { class: 'field', style: 'margin:var(--sp-3) 0 0;' });
    originsField.appendChild(H.el('label', { text: '白名单来源（逗号分隔，取消上方勾选后生效）' }));
    const originsInput = H.el('input', {
      type: 'text', class: 'mono',
      value: ((settings.cors && settings.cors.origins) || []).join(', '),
      placeholder: 'https://admin.example.com, https://app.example.com',
    });
    originsField.appendChild(originsInput);
    // 允许所有来源时白名单不生效，但保持可编辑：允许先填好再取消勾选

    main.appendChild(section('CORS', '浏览器端跨域调用 /hook 时的来源放行规则。', [allowAllRow, originsField]));

    // ---- 签名 ----
    const cbSig = H.el('input', { type: 'checkbox' });
    if (settings.signature && settings.signature.enabled) cbSig.checked = true;
    main.appendChild(section(
      '请求签名校验',
      '开启后调用 /hook/令牌 必须携带 X-Signature 与 X-Timestamp 头。需先在 Cloudflare 配置 SIGN_SECRET 环境变量。',
      [checkRow(cbSig, '启用 X-Signature HMAC 校验')]
    ));

    // ---- 保存 ----
    const saveBtn = H.el('button', {
      class: 'btn btn-primary', type: 'button', text: '保存全局设置',
      style: 'margin-top:var(--sp-4);',
    });
    main.appendChild(saveBtn);
    saveBtn.addEventListener('click', async () => {
      const body = {
        timeoutMs: Number(tInput.value) || 8000,
        retries: Number(rInput.value) || 0,
        defaultChannels: Array.from(defList.querySelectorAll('input[type=checkbox]:checked')).map((c) => c.value),
        cors: {
          allowAll: cbAll.checked,
          origins: originsInput.value.split(',').map((s) => s.trim()).filter(Boolean),
        },
        signature: { enabled: cbSig.checked },
      };
      saveBtn.disabled = true;
      const label = saveBtn.textContent;
      saveBtn.textContent = '保存中…';
      try {
        await H.api('/api/settings', { method: 'PUT', body });
        H.toast('全局设置已保存', 'ok');
      } catch (e) {
        H.toast(e.message, 'err');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
      }
    });
    box.appendChild(main);

    // ---- Webhook 地址（取第一个启用令牌） ----
    const first = tokens.find((t) => t.enabled !== false) || tokens[0];
    if (first) {
      const card = H.el('div', { class: 'panel' });
      const head = H.el('div', { class: 'panel-head' });
      head.appendChild(H.el('h2', { class: 'panel-title', text: 'Webhook 地址' }));
      head.appendChild(H.el('span', { class: 'panel-desc', text: `${first.name || '未命名'} · 调用入口` }));
      card.appendChild(head);

      const url = `${location.origin}/hook/${first.token}`;
      const row = H.el('div', { class: 'copy-row' });
      const inp = H.el('input', { type: 'text', readonly: '', value: url, class: 'mono', 'aria-label': 'Webhook 地址' });
      const copyBtn = H.el('button', { class: 'btn btn-sm', type: 'button', text: '复制' });
      row.appendChild(inp);
      row.appendChild(copyBtn);
      card.appendChild(row);
      copyBtn.addEventListener('click', () => H.copyText(url, inp));

      card.appendChild(H.el('p', { class: 'field-hint', style: 'margin:var(--sp-3) 0 4px;', text: 'curl 示例' }));
      card.appendChild(H.el('pre', {
        style: 'margin:0;',
        text: `curl -X POST ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Hello","body":"World","level":"info"}'`,
      }));
      box.appendChild(card);
    }

    // ---- 备份与恢复 ----
    const bak = H.el('div', { class: 'panel' });
    const bakHead = H.el('div', { class: 'panel-head' });
    const bakTitle = H.el('div');
    bakTitle.appendChild(H.el('h2', { class: 'panel-title', text: '备份与恢复' }));
    bakTitle.appendChild(H.el('p', {
      class: 'panel-desc', text: '导出全部配置为 JSON（不消耗 KV 写）；导入时一次性批量写入。',
    }));
    bakHead.appendChild(bakTitle);
    bak.appendChild(bakHead);

    const bakActions = H.el('div', { class: 'page-actions' });
    const btnExport = H.el('button', { class: 'btn', type: 'button', text: '导出全部配置' });
    const btnImport = H.el('button', { class: 'btn', type: 'button', text: '导入 JSON 恢复' });
    bakActions.appendChild(btnExport);
    bakActions.appendChild(btnImport);
    bak.appendChild(bakActions);
    box.appendChild(bak);

    // 导出
    btnExport.addEventListener('click', async () => {
      btnExport.disabled = true;
      try {
        const data = await H.api('/api/config/export');
        const blob = new Blob([JSON.stringify({ config: data.config }, null, 2)], { type: 'application/json' });
        const a = H.el('a', {
          href: URL.createObjectURL(blob),
          download: `hookhub-config-${new Date().toISOString().slice(0, 10)}.json`,
        });
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        H.toast('已导出配置文件', 'ok');
      } catch (e) {
        H.toast('导出失败: ' + e.message, 'err');
      } finally {
        btnExport.disabled = false;
      }
    });

    // 导入
    btnImport.addEventListener('click', () => {
      const fileInput = H.el('input', { type: 'file', accept: '.json,application/json', class: 'file-input-hidden' });
      document.body.appendChild(fileInput);
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) { fileInput.remove(); return; }
        try {
          const data = JSON.parse(await file.text());
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