import { forwardRef } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect, ForeignObject } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';

const S = 400;
const CX = 200;
const CY = 200;
const DEG = Math.PI / 180;

const RING_R = [70, 90, 110, 130, 150] as const;
const RING_COLOR = ['#5855f4', '#7c3aed', '#9333ea', '#db2777', '#ea580c'] as const;
const STROKE_W = 12;

// QR fits inside innermost ring (r=70), with margin
const QR_SIZE = 100;
const QR_OFFSET = CX - QR_SIZE / 2;

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

export const RingTagGenerator = forwardRef<Svg, Props>(function RingTagGenerator(
  { code, size = 300 },
  ref,
) {
  return (
    <Svg ref={ref} width={size} height={size} viewBox={`0 0 ${S} ${S}`}>
      <Rect width={S} height={S} fill="#0f0a1e" />

      <Rect
        x={5} y={5}
        width={S - 10} height={S - 10}
        fill="none"
        stroke="#3a3060"
        strokeWidth={1.5}
      />

      {/* Corner brackets */}
      {(
        [
          { x: 18, y: 18, rx: 1, ry: 1, a: 36 },
          { x: S - 18, y: 18, rx: -1, ry: 1, a: 28 },
          { x: 18, y: S - 18, rx: 1, ry: -1, a: 24 },
          { x: S - 18, y: S - 18, rx: -1, ry: -1, a: 18 },
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

      {/* Decorative rings (visual only — QR carries the data now) */}
      {RING_R.map((r, ri) =>
        Array.from({ length: 12 }, (_, s) => (
          <Path
            key={`${ri}-${s}`}
            d={arcPath(r, s * 30 + 3, s * 30 + 27)}
            stroke={RING_COLOR[ri]}
            strokeWidth={STROKE_W}
            fill="none"
            strokeLinecap="round"
            opacity={0.4}
          />
        ))
      )}

      {/* White background behind QR so it reads cleanly */}
      <Rect
        x={QR_OFFSET - 4} y={QR_OFFSET - 4}
        width={QR_SIZE + 8} height={QR_SIZE + 8}
        fill="#ffffff"
        rx={4}
      />

      {/* QR code embedded in center */}
      <ForeignObject x={QR_OFFSET} y={QR_OFFSET} width={QR_SIZE} height={QR_SIZE}>
        <View style={{ width: QR_SIZE, height: QR_SIZE }}>
          <QRCode value={code} size={QR_SIZE} backgroundColor="white" color="black" />
        </View>
      </ForeignObject>
    </Svg>
  );
});
