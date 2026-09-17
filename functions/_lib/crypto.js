// 加密工具：常量时间比较 + HMAC（使用 Web Crypto，Workers 原生支持）

export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/**
 * 常量时间字符串比较：先对两边做 SHA-256 摘要再逐字节比较。
 * 避免长度泄露 + 时间侧信道（用于管理员密码校验）。
 */
export async function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const ba = new Uint8Array(ha);
  const bb = new Uint8Array(hb);
  // 摘要长度必然相同，但防御性保留长度检查
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

/**
 * HMAC-SHA256。
 * msg 为空时也可用（飞书签名就是 key=timestamp\nsecret，对空串做 HMAC）。
 */
export async function hmacSha256(key, msg, encoding = 'base64') {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  const bytes = new Uint8Array(sig);
  return encoding === 'base64' ? bytesToBase64(bytes) : bytes;
}