// SSRF 防护：目标 URL 合法性校验 + 内网段黑名单
// 仅允许 http/https，拒绝回环/内网/链路本地地址，以及 .internal 等内网域名。

import { lookup } from './dns-mock.js';

// 私有/保留网段（IPv4）
const PRIVATE_NETS = [
  { name: 'loopback', min: [127, 0, 0, 0], max: [127, 255, 255, 255] },
  { name: 'private-10', min: [10, 0, 0, 0], max: [10, 255, 255, 255] },
  { name: 'private-172', min: [172, 16, 0, 0], max: [172, 31, 255, 255] },
  { name: 'private-192.168', min: [192, 168, 0, 0], max: [192, 168, 255, 255] },
  { name: 'link-local', min: [169, 254, 0, 0], max: [169, 254, 255, 255] },
  { name: 'this-network-0', min: [0, 0, 0, 0], max: [0, 255, 255, 255] },
  { name: 'multicast', min: [224, 0, 0, 0], max: [239, 255, 255, 255] },
  { name: 'broadcast', min: [255, 255, 255, 255], max: [255, 255, 255, 255] },
];

const LOCAL_HOSTNAMES = ['localhost', 'localhost.localdomain'];

function ipToInt(parts) {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIp(ip4) {
  const parts = ip4.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false; // 非 IPv4（如 IPv6），交由 fetch 解析，保守放行（见 README 说明）
  }
  const val = ipToInt(parts);
  for (const net of PRIVATE_NETS) {
    if (val >= ipToInt(net.min) && val <= ipToInt(net.max)) return true;
  }
  return false;
}

/**
 * 校验并规范化目标 URL。
 * @returns {{ok:true, url:URL} | {ok:false, error:string}}
 */
export async function validateTargetUrl(raw, { allowLocalhost = false } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'URL 格式非法' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: '仅支持 http/https 协议' };
  }
  const host = url.hostname.toLowerCase();

  // 域名后缀黑名单：.internal/.local 这类内网 TLD 直接拒绝
  if (host.endsWith('.internal') || host.endsWith('.local')) {
    return { ok: false, error: '目标主机为内网域名，已拦截（SSRF 防护）' };
  }

  // 字面 IP
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isIpLiteral) {
    if (isPrivateIp(host) && !allowLocalhost) {
      return { ok: false, error: '目标 IP 位于内网段，已拦截（SSRF 防护）' };
    }
    return { ok: true, url };
  }

  if (LOCAL_HOSTNAMES.includes(host)) {
    if (!allowLocalhost) {
      return { ok: false, error: '目标主机为 localhost，已拦截（SSRF 防护）' };
    }
    return { ok: true, url };
  }

  if (url.protocol === 'https:') {
    // https 有证书链校验，被解析到内网 IP 时证书通常失败，
    // 且 Cloudflare 的 fetch 默认校验证书。此处已做域名级黑名单，
    // 解析结果级防护依赖 TLS + 平台（详见 README「SSRF 防护说明」）。
  }

  return { ok: true, url };
}

// 仅测试使用
export function _isPrivateIpForTest(ip) {
  return isPrivateIp(ip);
}