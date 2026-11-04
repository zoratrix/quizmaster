import { useCallback, useEffect, useState } from 'react';
import type { BackgroundMusicState } from '../../../shared/api';

export interface MusicControlsProps {
  /** В паке есть хотя бы один трек фоновой музыки */
  hasMusic: boolean;
  /** Сколько треков в паке — показывается подписью под заголовком */
  musicCount?: number;
}

/** «1 трек», «2 трека», «5 треков» */
function tracksLabel(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  let word = 'треков';
  if (!(abs > 10 && abs < 20)) {
    if (last === 1) word = 'трек';
    else if (last >= 2 && last <= 4) word = 'трека';
  }
  return `${count} ${word}`;
}

/**
 * Компактная панель ведущего для управления фоновой музыкой пака.
 *
 * Громкость, пауза и mute живут в main-процессе (общие для всех окон): панель
 * только отправляет патчи через `setMusicState` и показывает состояние из
 * события `game:music` — так же, как игровое окно. Если музыки в паке нет,
 * панель не показывается.
 */
export function MusicControls({ hasMusic, musicCount = 0 }: MusicControlsProps) {
  const [settings, setSettings] = useState<BackgroundMusicState | null>(null);

  const refresh = useCallback((): void => {
    void window.qm.game
      .getMusicState()
      .then((next) => setSettings(next))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const off = window.qm.onMusicState((next) => setSettings(next));
    return off;
  }, [refresh]);

  /** Оптимистично двигаем панель, чтобы ползунок не «дёргался»; истина — в main. */
  const apply = useCallback(
    (patch: Partial<BackgroundMusicState>): void => {
      setSettings((current) => (current ? { ...current, ...patch } : current));
      void window.qm.game.setMusicState(patch).catch(refresh);
    },
    [refresh]
  );

  if (!hasMusic || !settings) return null;

  const volume = Math.round(settings.volume * 100);

  return (
    <aside className="music-controls" aria-label="Управление фоновой музыкой">
      <div className="music-controls__head">
        <span className="music-controls__title">Фоновая музыка</span>
        {musicCount > 0 ? <span className="music-controls__count">{tracksLabel(musicCount)}</span> : null}
      </div>

      <div className="music-controls__volume">
        <span className="music-controls__label" aria-hidden="true">
          Громкость
        </span>
        <input
          className="music-controls__slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          aria-label="Громкость фоновой музыки"
          title={`Громкость ${volume}%`}
          onChange={(event) => apply({ volume: Number(event.target.value) / 100 })}
        />
        <span className="music-controls__value tabular">{volume}%</span>
      </div>

      <div className="music-controls__buttons">
        <button
          type="button"
          className="music-controls__btn"
          aria-pressed={settings.paused}
          aria-label={settings.paused ? 'Продолжить фоновую музыку' : 'Поставить фоновую музыку на паузу'}
          onClick={() => apply({ paused: !settings.paused })}
        >
          {settings.paused ? '▶ Продолжить' : '❚❚ Пауза'}
        </button>
        <button
          type="button"
          className="music-controls__btn"
          aria-pressed={settings.muted}
          aria-label={settings.muted ? 'Включить звук фоновой музыки' : 'Выключить звук фоновой музыки'}
          onClick={() => apply({ muted: !settings.muted })}
        >
          {settings.muted ? '🔊 Со звуком' : '🔇 Без звука'}
        </button>
      </div>
    </aside>
  );
}
