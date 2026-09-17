// DNS 解析 Mock —— 本模块当前不使用 Node 的 dns 模块（Workers 环境无 dns 解析 API）。
// 保留此文件仅为占位：SSRF 防护目前基于「域名级黑名单 + https 证书链」，
// 不做解析级阻断。详见 README「SSRF 防护说明」。

export async function lookup() {
  return [];
}