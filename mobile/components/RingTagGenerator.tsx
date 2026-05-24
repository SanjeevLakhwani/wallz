import { forwardRef } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { encodeRingTag } from '@/lib/ringTag';

const S = 400;
const CX = 200;
const CY = 200;
const DEG = Math.PI / 180;

const RING_R = [70, 90, 110, 130, 150] as const;
const RING_COLOR = ['#5855f4', '#7c3aed', '#9333ea', '#db2777', '#ea580c'] as const;
const ANCHOR_R = 172;
const STROKE_W = 12;

// Arc segment: clockwise from a0° to a1° (both measured CW from 12 o'clock)
function arcPath(r: number, a0: number, a1: number): string {
  const x1 = CX + r * Math.sin(a0 * DEG);
  const y1 = CY - r * Math.cos(a0 * DEG);
  const x2 = CX + r * Math.sin(a1 * DEG);
  const y2 = CY - r * Math.cos(a1 * DEG);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

interface Props {
  code: string;
  size?: number;
}

// forwardRef exposes the Svg node so callers can call .toDataURL() for ARKit reference image export
export const RingTagGenerator = forwardRef<Svg, Props>(function RingTagGenerator(
  { code, size = 300 },
  ref,
) {
  const rings = encodeRingTag(code);

  return (
    <Svg ref={ref} width={size} height={size} viewBox={`0 0 ${S} ${S}`}>
      {/* Dark background */}
      <Rect width={S} height={S} fill="#0f0a1e" />

      {/* Thin white border */}
      <Rect
        x={5} y={5}
        width={S - 10} height={S - 10}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.5}
      />

      {/* Asymmetric corner brackets — arm length encodes orientation for ARKit */}
      {(
        [
          { x: 18, y: 18, rx: 1, ry: 1, a: 36 },      // TL — largest
          { x: S - 18, y: 18, rx: -1, ry: 1, a: 28 },  // TR
          { x: 18, y: S - 18, rx: 1, ry: -1, a: 24 },  // BL
          { x: S - 18, y: S - 18, rx: -1, ry: -1, a: 18 }, // BR — smallest
        ] as const
      ).map(({ x, y, rx, ry, a }, i) => (
        <Path
          key={i}
          d={`M${x} ${y + ry * a} L${x} ${y} L${x + rx * a} ${y}`}
          stroke="#ffffff"
          strokeWidth={3}
          fill="none"
          strokeLinecap="square"
        />
      ))}

      {/* Data rings — arc present = bit 1, gap = bit 0 */}
      {rings.map((ring, r) =>
        ring.map((bit, s) =>
          bit ? (
            <Path
              key={`${r}-${s}`}
              d={arcPath(RING_R[r], s * 30 + 3, s * 30 + 27)}
              stroke={RING_COLOR[r]}
              strokeWidth={STROKE_W}
              fill="none"
              strokeLinecap="round"
            />
          ) : null
        )
      )}

      {/* CV anchor dots: 12 o'clock (0°), 4 o'clock (120°), 8 o'clock (240°) */}
      {([0, 120, 240] as const).map((deg) => (
        <Circle
          key={deg}
          cx={CX + ANCHOR_R * Math.sin(deg * DEG)}
          cy={CY - ANCHOR_R * Math.cos(deg * DEG)}
          r={8}
          fill="#ffffff"
        />
      ))}

      {/* Center dot */}
      <Circle cx={CX} cy={CY} r={12} fill="#7c3aed" />
      <Circle cx={CX} cy={CY} r={6} fill="#ffffff" />
    </Svg>
  );
});
