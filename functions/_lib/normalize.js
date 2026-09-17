// 请求归一化：把各种入站格式统一成标准 schema
// 标准 schema：{ title, body, level, channel, targets, tags, url, data }

export const LEVELS = ['info', 'success', 'warning', 'error'];

export function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function str(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function normalizeLevel(level) {
  if (LEVELS.includes(level)) return level;
  if (level === 'warn') return 'warning';
  if (level === 'err' || level === 'critical' || level === 'fatal' || level === 'panic') return 'error';
  if (level === 'ok' || level === 'success') return 'success';
  if (level === 'debug' || level === 'verbose' || level === 'trace') return 'info';
  return 'info';
}

/**
 * 归一化入站数据（GET query / JSON / text / form）。
 * @returns {{ok:true, payload} | {ok:false, error}}
 */
export function normalizeInput(searchParams, bodyText, contentType) {
  const payload = {
    title: '',
    body: '',
    level: 'info',
    channel: '',
    targets: [],
    tags: [],
    url: '',
    data: {},
  };

  // ---- 来源 1：GET query 参数 ----
  if (searchParams) {
    const q = (k) => searchParams.get(k);
    payload.title = str(q('title'));
    payload.body = str(q('body') ?? q('desp') ?? q('text') ?? q('content'));
    payload.level = normalizeLevel(str(q('level')));
    payload.channel = str(q('channel'));
    payload.url = str(q('url'));
    const tg = q('targets') ?? q('target');
    if (tg) payload.targets = String(tg).split(',').map((s) => s.trim()).filter(Boolean);
    const tg2 = q('tags');
    if (tg2) payload.tags = String(tg2).split(',').map((s) => s.trim()).filter(Boolean);
    const rawData = q('data');
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        if (isPlainObject(parsed)) payload.data = parsed;
      } catch {
        payload.data = { raw: rawData };
      }
    }
  }

  // ---- 来源 2：body ----
  const ct = (contentType || '').toLowerCase();
  const hasBody = bodyText != null && bodyText.length > 0;

  if (hasBody) {
    if (ct.includes('application/json') || (ct.includes('application/x-www-form-urlencoded') === false && ct.startsWith('text/plain') === false)) {
      // 默认按 JSON 尝试
      try {
        const obj = JSON.parse(bodyText);
        if (isPlainObject(obj)) {
          payload.title = str(obj.title ?? payload.title);
          payload.body = str(obj.body ?? obj.desp ?? obj.text ?? obj.content ?? payload.body);
          payload.level = normalizeLevel(str(obj.level ?? payload.level));
          payload.channel = str(obj.channel ?? payload.channel);
          const tg = obj.targets ?? obj.target;
          if (tg != null) payload.targets = (Array.isArray(tg) ? tg : String(tg).split(','))
            .map((s) => str(s).trim()).filter(Boolean);
          const tg2 = obj.tags;
          if (tg2 != null) payload.tags = (Array.isArray(tg2) ? tg2 : String(tg2).split(','))
            .map((s) => str(s).trim()).filter(Boolean);
          payload.url = str(obj.url ?? payload.url);
          if (isPlainObject(obj.data)) payload.data = obj.data;
          else if (obj.data != null) payload.data = { raw: obj.data };
        } else if (typeof obj === 'string') {
          payload.body = payload.body || obj;
        }
      } catch {
        // 解析失败按纯文本处理
        payload.body = payload.body || bodyText;
      }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const q = new URLSearchParams(bodyText);
      const g = (k) => q.get(k) ?? '';
      payload.title = payload.title || str(g('title'));
      payload.body = payload.body || str(g('body') || g('desp') || g('text') || g('content'));
      payload.level = normalizeLevel(str(g('level') || payload.level));
      payload.channel = payload.channel || str(g('channel'));
      const tg = g('targets') || g('target');
      if (tg) payload.targets = tg.split(',').map((s) => s.trim()).filter(Boolean);
      const tag = g('tags');
      if (tag) payload.tags = tag.split(',').map((s) => s.trim()).filter(Boolean);
      const rawData = g('data');
      if (rawData) {
        try {
          const parsed = JSON.parse(rawData);
          if (isPlainObject(parsed)) payload.data = parsed;
        } catch {
          payload.data = { raw: rawData };
        }
      }
    } else {
      // text/plain 等
      payload.body = payload.body || bodyText;
    }
  }

  // 兜底：title 缺失时从 body 首行截取
  if (!payload.title && payload.body) {
    const firstLine = payload.body.split('\n')[0];
    payload.title = firstLine.length > 50 ? firstLine.slice(0, 50) + '…' : firstLine;
  }
  if (!payload.body && payload.title) {
    payload.body = payload.title;
  }

  // targets 支持 'all' 或 'channel:xxx'
  return { ok: true, payload };
}