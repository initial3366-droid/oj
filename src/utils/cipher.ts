/**
 * 题目 ID 加密工具
 * 将数字 ID 加密为 8 位数字字符串（固定密钥，创建后不变）
 */

const SECRET = "QOJ_CIPHER_2026_SALT";

/**
 * 读取Key并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function getKey(): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < SECRET.length; i++) {
    h ^= SECRET.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const PERM = [5, 2, 7, 1, 4, 0, 6, 3];
const INV_PERM: number[] = (() => {
  const arr = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 8; i++) arr[PERM[i]] = i;
  return arr;
})();

const KEY = getKey();

/**
 * 加密：数字 ID → 8 位数字字符串
 */
export function encryptId(id: number): string {
  const digits = String(id % 100_000_000).padStart(8, "0").split("").map(Number);
  const xored = digits.map((d, i) => (d + ((KEY >> (i * 3)) & 7)) % 10);
  const permuted = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 8; i++) permuted[PERM[i]] = xored[i];
  return permuted.join("");
}

/**
 * 解密：8 位数字字符串 → 原始数字 ID
 */
export function decryptId(encoded: string): number {
  const digits = encoded.split("").map(Number);
  const unpermuted = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 8; i++) unpermuted[INV_PERM[i]] = digits[i];
  const result = unpermuted.map((d, i) => {
    const v = d - ((KEY >> (i * 3)) & 7);
    return v < 0 ? v + 10 : v;
  });
  return Number(result.join(""));
}

/**
 * 从 URL 中的加密 ID 解密为原始数字 ID
 */
export function decryptIdFromUrl(encoded: string): number {
  return decryptId(encoded);
}
