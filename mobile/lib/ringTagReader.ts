// VisionCamera frame processor worklet — Ring Tag CV reader
// All exported functions are worklets; call detectRingTag from useFrameProcessor.
//
// Detection pipeline:
//   1. Scan Y channel for bright circular blobs (anchor dots, luminance > 220)
//   2. Compute marker center + scale from centroid of top-3 blobs
//   3. Try each blob as the 12-o'clock anchor to recover rotation
//   4. Sample brightness at 12 polar positions per ring × 5 rings
//   5. Threshold → 60-bit array → XOR checksum verify → decode ASCII

import type { Frame } from 'react-native-vision-camera';

export type RingTagDetection = {
  center: { x: number; y: number } | null;
  scale: number;
  code: string | null;
};

const RINGS = 5;
const SEGS = 12;
const DATA = 11;
const RING_R = [70, 90, 110, 130, 150] as const; // design-space radii (px at size=400)
const ANCHOR_R = 172; // design-space anchor dot radius
const DEG = Math.PI / 180;

function sampleY(
  data: Uint8Array,
  bpr: number,
  px: number,
  py: number,
  w: number,
  h: number,
): number {
  'worklet';
  const x = Math.max(1, Math.min(w - 2, Math.round(px)));
  const y = Math.max(1, Math.min(h - 2, Math.round(py)));
  let sum = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      sum += data[(y + dy) * bpr + (x + dx)];
    }
  }
  return sum / 9;
}

function findAnchorDots(
  data: Uint8Array,
  w: number,
  h: number,
  bpr: number,
  threshold: number,
): Array<{ x: number; y: number }> {
  'worklet';
  const stride = 4;
  // Simple greedy clustering: merge bright pixels within 30px
  const clusters: Array<{ cx: number; cy: number; n: number }> = [];

  for (let y = stride; y < h - stride; y += stride) {
    for (let x = stride; x < w - stride; x += stride) {
      if (data[y * bpr + x] < threshold) continue;

      let found = false;
      for (let i = 0; i < clusters.length; i++) {
        const dx = x - clusters[i].cx;
        const dy = y - clusters[i].cy;
        if (dx * dx + dy * dy < 900) {
          const n = clusters[i].n;
          clusters[i].cx = (clusters[i].cx * n + x) / (n + 1);
          clusters[i].cy = (clusters[i].cy * n + y) / (n + 1);
          clusters[i].n = n + 1;
          found = true;
          break;
        }
      }
      if (!found) clusters.push({ cx: x, cy: y, n: 1 });
    }
  }

  // Sort by size, keep top 3 with at least 3 pixels
  const sorted = clusters.slice().sort((a, b) => b.n - a.n);
  const result: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < sorted.length && result.length < 3; i++) {
    if (sorted[i].n >= 3) result.push({ x: sorted[i].cx, y: sorted[i].cy });
  }
  return result;
}

function tryDecode(
  dots: Array<{ x: number; y: number }>,
  cx: number,
  cy: number,
  scale: number,
  topIdx: number,
  data: Uint8Array,
  w: number,
  h: number,
  bpr: number,
): string | null {
  'worklet';
  const top = dots[topIdx];
  // Rotation: angle of top-dot from straight-up (CW, degrees)
  const rotation = Math.atan2(top.x - cx, -(top.y - cy)) * (1 / DEG);

  // Sample 5 rings × 12 segments
  const rings: boolean[][] = [];
  for (let r = 0; r < RINGS; r++) {
    const ring: boolean[] = [];
    const radius = RING_R[r] * scale;
    for (let s = 0; s < SEGS; s++) {
      const rad = (s * 30 + 15 + rotation) * DEG;
      const brightness = sampleY(
        data,
        bpr,
        cx + radius * Math.sin(rad),
        cy - radius * Math.cos(rad),
        w,
        h,
      );
      ring.push(brightness > 128);
    }
    rings.push(ring);
  }

  // XOR checksum per ring
  for (let r = 0; r < RINGS; r++) {
    let xor = false;
    for (let s = 0; s < DATA; s++) xor = xor !== rings[r][s];
    if (xor !== rings[r][DATA]) return null;
  }

  // Decode 55 payload bits → 7-char ASCII
  let code = '';
  let bitIdx = 0;
  for (let i = 0; i < 7; i++) {
    let c = 0;
    for (let b = 0; b < 7; b++) {
      const ring = Math.floor(bitIdx / DATA);
      const seg = bitIdx % DATA;
      c = (c << 1) | (rings[ring][seg] ? 1 : 0);
      bitIdx++;
    }
    if (c === 0) break;
    code += String.fromCharCode(c);
  }

  return code || null;
}

export function detectRingTag(frame: Frame): RingTagDetection {
  'worklet';
  const w = frame.width;
  const h = frame.height;
  const bpr = frame.bytesPerRow;
  const buf = frame.toArrayBuffer();
  const data = new Uint8Array(buf);

  const dots = findAnchorDots(data, w, h, bpr, 220);
  if (dots.length < 3) return { center: null, scale: 1, code: null };

  const cx = (dots[0].x + dots[1].x + dots[2].x) / 3;
  const cy = (dots[0].y + dots[1].y + dots[2].y) / 3;

  let avgDist = 0;
  for (let i = 0; i < 3; i++) {
    const dx = dots[i].x - cx;
    const dy = dots[i].y - cy;
    avgDist += Math.sqrt(dx * dx + dy * dy);
  }
  const scale = avgDist / 3 / ANCHOR_R;
  if (scale < 0.01) return { center: { x: cx, y: cy }, scale, code: null };

  // Try each dot as the 12-o'clock anchor — handles any 120° rotation step
  for (let topIdx = 0; topIdx < 3; topIdx++) {
    const code = tryDecode(dots, cx, cy, scale, topIdx, data, w, h, bpr);
    if (code) return { center: { x: cx, y: cy }, scale, code };
  }

  return { center: { x: cx, y: cy }, scale, code: null };
}
