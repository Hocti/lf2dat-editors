// 舊版 LF2（1.x／2.0）的 .dat：跳過前 123 個位元組，每個位元組減去金鑰，再用 Big5 解成文字。
// 金鑰與 src/shared/legacyModFiles.ts 的 decryptDat 相同。明文檔（已有 <bmp_begin> 等）不解密。
// Old LF2 (1.x / 2.0) .dat: skip the first 123 bytes, subtract the key from each byte, then decode as Big5.
// The key matches decryptDat in src/shared/legacyModFiles.ts. Plain files (they already contain <bmp_begin> and so on) are not decrypted.

const DAT_KEY = 'odBearBecauseHeIsVeryGoodSiuHungIsAGo'
const DAT_HEADER = 123
// 物件、背景、關卡解密後一定看得到其中一個。 / An object, background, or stage file shows one of these after decrypt.
const MARKER = /<bmp_begin>|<frame>|<stage>|<background>|layer:/

const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

export function decryptDatBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length <= DAT_HEADER) return new Uint8Array(0)
  const out = new Uint8Array(bytes.length - DAT_HEADER)
  for (let index = DAT_HEADER; index < bytes.length; index++) {
    out[index - DAT_HEADER] = (bytes[index] - DAT_KEY.charCodeAt((index - DAT_HEADER) % DAT_KEY.length)) & 255
  }
  return out
}

// 是 LF2 資料才回傳文字，否則 null（不要把別的 .dat 換掉）。
// Returns text only when this is LF2 data, otherwise null (leave other .dat files alone).
export function decodeLf2Dat(bytes: Uint8Array): string | null {
  const plain = MARKER.test(latin1(bytes.subarray(0, Math.min(bytes.length, 512))))
  const body = plain ? bytes : decryptDatBytes(bytes)
  const text = new TextDecoder('big5').decode(body).replace(/\u0000/g, '')
  if (!plain && !MARKER.test(text.slice(0, 8000))) return null
  return text
}
