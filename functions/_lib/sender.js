// 通用渠道请求发送：超时 + 重试 + SSRF 校验
// 所有适配器最终都通过这里发出 HTTP 请求。

import { validateTargetUrl } from './ssrf.js';

/**
 * 发送一次带超时和重试的 HTTP 请求。
 * @param {string} url 目标 URL（先过 SSRF 校验）
 * @param {object} opts
 * @param {number} opts.timeoutMs 超时（默认 8000）
 * @param {number} opts.retries 重试次数（不含首次，默认 2）
 * @param {boolean} opts.allowLocalhost 是否允许 localhost（默认 false，测试调试用）
 * @returns {Promise<{ok:boolean, status:number, body:string, error?:string}>}
 */
export async function sendHttp(url, { timeoutMs = 8000, retries = 2, allowLocalhost = false, ...fetchOpts } = {}) {
  const checked = await validateTargetUrl(url, { allowLocalhost });
  if (!checked.ok) {
    return { ok: false, status: 0, body: '', error: checked.error };
  }

  let attempt = 0;
  let lastError = '';
  while (attempt <= retries) {
    if (attempt > 0) {
      // 指数退避：1s、2s
      const delay = 1000 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(checked.url, { ...fetchOpts, signal: controller.signal });
      const body = await resp.text();
      const ok = resp.ok;
      return { ok, status: resp.status, body: body.slice(0, 4096), error: ok ? '' : `HTTP ${resp.status}` };
    } catch (err) {
      lastError = err && err.name === 'AbortError' ? `请求超时（>${timeoutMs}ms）` : String(err && err.message || err);
      if (err && err.name === 'AbortError') {
        // 超时不重试
        return { ok: false, status: 0, body: '', error: lastError };
      }
    } finally {
      clearTimeout(timer);
    }
    attempt++;
  }
  return { ok: false, status: 0, body: '', error: lastError };
}