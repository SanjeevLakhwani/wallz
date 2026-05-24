// Ring Tag encoding/decoding
// 5 rings × 12 segments = 60 bits (55 data + 5 checksum)
// Each ring: segments 0–10 = data (11 bits), segment 11 = XOR checksum
// Payload: 7 chars × 7-bit ASCII = 49 bits, zero-padded to 55
// Segment 0 = 12 o'clock position, clockwise

const RINGS = 5;
const SEGS = 12;
const DATA = 11; // data segments per ring

export function encodeRingTag(str: string): boolean[][] {
  const padded = str.slice(0, 7).padEnd(7, '\0');

  // Pack 7 × 7-bit ASCII chars into bits, MSB first
  const bits: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const c = padded.charCodeAt(i) & 0x7f;
    for (let b = 6; b >= 0; b--) bits.push(!!(c & (1 << b)));
  }
  // Pad to 55 bits (7×7 = 49, capacity is 5×11 = 55)
  while (bits.length < RINGS * DATA) bits.push(false);

  // Build 5 rings: 11 data bits + 1 XOR checksum
  const rings: boolean[][] = [];
  for (let r = 0; r < RINGS; r++) {
    const slice = bits.slice(r * DATA, r * DATA + DATA);
    const checksum = slice.reduce((x, b) => x !== b, false);
    rings.push([...slice, checksum]);
  }
  return rings;
}

export function decodeRingTag(rings: boolean[][]): string | null {
  if (rings.length !== RINGS || rings.some((r) => r.length !== SEGS)) return null;

  // Verify XOR checksum for each ring
  for (let r = 0; r < RINGS; r++) {
    const xor = rings[r].slice(0, DATA).reduce((x, b) => x !== b, false);
    if (xor !== rings[r][DATA]) return null;
  }

  // Extract 55 payload bits
  const bits: boolean[] = [];
  for (let r = 0; r < RINGS; r++) bits.push(...rings[r].slice(0, DATA));

  // Decode 7-bit ASCII, stop at null byte
  let result = '';
  for (let i = 0; i < 7; i++) {
    let code = 0;
    for (let b = 0; b < 7; b++) code = (code << 1) | (bits[i * 7 + b] ? 1 : 0);
    if (code === 0) break;
    result += String.fromCharCode(code);
  }

  return result || null;
}
