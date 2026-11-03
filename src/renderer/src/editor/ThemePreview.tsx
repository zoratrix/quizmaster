import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ThemeId } from '../../../shared/types';
import { formatBalls } from '../../../shared/format';
import { themeLabel, themeScheme } from '../../../shared/themes';
import { Countdown } from '../components/Countdown';
import '../styles/game.css';

/** Пример вопроса: показывает реальную типографику игрового экрана. */
const PREVIEW_QUESTION = 'Как называется самая большая планета Солнечной системы?';
const PREVIEW_TEAMS = ['«Импульс»', '«Вектор»', '«Сириус»'];
const PREVIEW_DURATION_MS = 30_000;
const PREVIEW_REMAINING_MS = 24_000;
const PREVIEW_BASE_WIDTH = 640;

export interface ThemePreviewProps {
  theme: ThemeId;
}

/**
 * Живой предпросмотр игрового экрана для окна «Настройки пака».
 *
 * Отрисовывается настоящей разметкой игрового экрана и настоящим game.css:
 * цвета приходят из темы пака через data-theme, в TSX нет копий палитр.
 * Обёртка .theme-preview (editor.css) переопределяет position: fixed у
 * .game-root и масштабирует содержимое через переменную --tp-w.
 */
export function ThemePreview({ theme }: ThemePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(PREVIEW_BASE_WIDTH);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const timerSize = Math.round(clamp(width * 0.16, 64, 120));
  const style = { '--tp-w': `${Math.round(width)}px` } as CSSProperties;

  return (
    <div
      className="theme-preview"
      ref={hostRef}
      style={style}
      role="img"
      aria-label={`Предпросмотр игрового экрана с темой «${themeLabel(theme)}»`}
    >
      <div className="game-root" data-theme={theme} data-scheme={themeScheme(theme)} data-phase="question">
        <div className="game-root__glow" aria-hidden="true" />
        <div className="game-root__decor" aria-hidden="true" />
        <section className="game-screen game-screen--question" aria-hidden="true">
          <header className="game-topbar">
            <div className="game-topbar__meta">
              <span className="game-round-label">Раунд 1 · Разминка</span>
              <span className="game-counter tabular">Вопрос 2 из 5</span>
              <span className="game-points">
                <span className="game-points__star" aria-hidden="true">
                  ★
                </span>
                <span className="tabular">{formatBalls(1)}</span>
              </span>
            </div>
            <div className="game-timer">
              <Countdown
                remainingMs={PREVIEW_REMAINING_MS}
                durationMs={PREVIEW_DURATION_MS}
                size={timerSize}
              />
            </div>
          </header>
          <div className="game-question">
            <p className="game-question__text">{PREVIEW_QUESTION}</p>
            <div className="theme-preview__teams">
              {PREVIEW_TEAMS.map((team) => (
                <span className="game-chip" key={team}>
                  {team}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
