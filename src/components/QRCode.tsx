import QR from "qrcode";
import { useMemo } from "react";

export interface QRCodeProps {
  value: string;
  size?: number;
  /** Module colour. Defaults to the page foreground. */
  fg?: string;
  bg?: string;
  className?: string;
}

/**
 * A QR rendered as rounded modules rather than hard squares, with a quiet zone
 * punched out of the middle for the mark.
 *
 * Error correction is fixed at H (30%): the centre cut-out destroys modules, and
 * the code still has to scan off a projector at an angle from the back of a room.
 */
export function QRCode({ value, size = 240, fg = "#f3f3f5", bg = "transparent", className }: QRCodeProps) {
  const matrix = useMemo(() => {
    try {
      const qr = QR.create(value, { errorCorrectionLevel: "H" });
      return { size: qr.modules.size, data: qr.modules.data as unknown as Uint8Array };
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) return null;

  const { size: count, data } = matrix;
  const quiet = 2;
  const total = count + quiet * 2;
  const unit = size / total;

  // Blank a circle in the middle for the logo. Keep it under ~14% of the module
  // area so error correction can still recover the code.
  const holeRadius = count * 0.115;
  const centre = count / 2 - 0.5;

  const dots: string[] = [];
  const finders: { x: number; y: number }[] = [
    { x: 0, y: 0 },
    { x: count - 7, y: 0 },
    { x: 0, y: count - 7 },
  ];

  const inFinder = (x: number, y: number) =>
    finders.some((f) => x >= f.x && x < f.x + 7 && y >= f.y && y < f.y + 7);

  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      if (!data[y * count + x]) continue;
      if (inFinder(x, y)) continue;
      if (Math.hypot(x - centre, y - centre) < holeRadius) continue;
      const cx = (x + quiet + 0.5) * unit;
      const cy = (y + quiet + 0.5) * unit;
      dots.push(`M ${cx} ${cy} m ${-unit * 0.36} 0 a ${unit * 0.36} ${unit * 0.36} 0 1 0 ${unit * 0.72} 0 a ${unit * 0.36} ${unit * 0.36} 0 1 0 ${-unit * 0.72} 0`);
    }
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="QR code to join the vote"
    >
      {bg !== "transparent" && <rect width={size} height={size} rx={unit * 2} fill={bg} />}
      <path d={dots.join(" ")} fill={fg} />
      {finders.map((f) => {
        const x = (f.x + quiet) * unit;
        const y = (f.y + quiet) * unit;
        const s = 7 * unit;
        return (
          <g key={`${f.x}-${f.y}`}>
            <rect
              x={x}
              y={y}
              width={s}
              height={s}
              rx={s * 0.28}
              fill="none"
              stroke={fg}
              strokeWidth={unit}
            />
            <rect
              x={x + s * 0.285}
              y={y + s * 0.285}
              width={s * 0.43}
              height={s * 0.43}
              rx={s * 0.14}
              fill={fg}
            />
          </g>
        );
      })}
    </svg>
  );
}
