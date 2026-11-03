import { formatClock } from '../../../shared/format';

export interface CountdownProps {
  remainingMs: number;
  durationMs: number;
  size?: number;
  paused?: boolean;
  ended?: boolean;
  /** Показывать подпись под таймером */
  caption?: string;
}

/**
 * Крупный круговой таймер для игрового экрана.
 * Цвет меняется: спокойный → предупреждение → критические секунды.
 */
export function Countdown({ remainingMs, durationMs, size = 220, paused, ended, caption }: CountdownProps) {
  const safeDuration = Math.max(1, durationMs);
  const remaining = Math.max(0, Math.min(remainingMs, safeDuration));
  const ratio = remaining / safeDuration;
  const seconds = Math.ceil(remaining / 1000);

  const stroke = Math.max(6, Math.round(size * 0.055));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * Math.max(0.0001, ratio);

  const tone = ended || seconds <= 0 ? 'bad' : ratio <= 0.2 ? 'bad' : ratio <= 0.5 ? 'mid' : 'ok';
  const colors: Record<string, string> = { ok: '#34d399', mid: '#fbbf24', bad: '#f87171' };
  const color = colors[tone];

  return (
    <div className={`countdown countdown--${tone}${paused ? ' countdown--paused' : ''}`} style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="countdown__svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: 'stroke-dasharray 120ms linear, stroke 300ms ease',
            filter: `drop-shadow(0 0 ${Math.round(size * 0.03)}px ${color}66)`
          }}
        />
      </svg>
      <div className="countdown__value" style={{ color, fontSize: Math.round(size * 0.32) }}>
        {ended ? '0' : Math.max(0, seconds)}
      </div>
      <div className="countdown__unit" style={{ fontSize: Math.max(11, Math.round(size * 0.055)) }}>
        {caption ?? (paused ? 'пауза' : 'сек')}
      </div>
      <div className="countdown__clock mono" style={{ fontSize: Math.max(12, Math.round(size * 0.065)) }}>
        {formatClock(remaining)}
      </div>
    </div>
  );
}
