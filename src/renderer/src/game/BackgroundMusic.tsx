import { useEffect, useRef, useState } from 'react';
import type { BackgroundMusicState } from '../../../shared/api';
import type { GameState } from '../../../shared/types';
import { mediaUrl } from '../lib/media';
import fanfareUrl from '../assets/fanfare.mp3';

/** Фазы, в которых играет фоновая музыка пака (в вопросах — тишина, чтобы не мешать аудио вопроса). */
const MUSIC_PHASES: ReadonlySet<GameState['phase']> = new Set<GameState['phase']>([
  'lobby',
  'round-intro',
  'round-handin',
  'round-summary',
  'finished'
]);

const DEFAULT_STATE: BackgroundMusicState = { volume: 0.35, muted: false, paused: false };

/**
 * Фоновая музыка пака и фанфары в конце игры.
 *
 * Плеер живёт в игровом окне (там же, где играет аудио вопросов), громкость и
 * пауза приходят из main-процесса — их меняет ведущий в панели управления.
 * Плейлист идёт по кругу; фанфары играют один раз при первом показе итогов.
 */
export function BackgroundMusic({ state }: { state: GameState | null }) {
  const [settings, setSettings] = useState<BackgroundMusicState>(DEFAULT_STATE);
  const [trackIndex, setTrackIndex] = useState(0);
  const [fanfarePlaying, setFanfarePlaying] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const fanfareRef = useRef<HTMLAudioElement | null>(null);
  const lastPhase = useRef<GameState['phase'] | null>(null);

  const tracks = state?.pack.music ?? [];
  const active = Boolean(state && MUSIC_PHASES.has(state.phase)) && tracks.length > 0;
  const track = tracks.length > 0 ? tracks[trackIndex % tracks.length] : null;
  const src = track ? mediaUrl(track.id) : '';

  // Настройки громкости/паузы — общие для окон, источник истины в main.
  useEffect(() => {
    let alive = true;
    void window.qm.game
      .getMusicState()
      .then((next) => {
        if (alive) setSettings(next);
      })
      .catch(() => undefined);
    const off = window.qm.onMusicState(setSettings);
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Новая игра — плейлист с начала.
  useEffect(() => {
    setTrackIndex(0);
    const audio = musicRef.current;
    if (audio) audio.currentTime = 0;
  }, [state?.sessionId]);

  // Включаем/ставим на паузу фон в зависимости от фазы и настроек ведущего.
  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;
    const duck = fanfarePlaying ? 0.25 : 1;
    audio.volume = Math.max(0, Math.min(1, (settings.muted ? 0 : settings.volume) * duck));
    if (!active || settings.paused) {
      audio.pause();
      return;
    }
    void audio.play().catch(() => undefined);
  }, [active, src, settings, fanfarePlaying]);

  // Несколько треков — по очереди; один трек повторяется через loop.
  const handleTrackEnded = (): void => {
    if (tracks.length > 1) setTrackIndex((index) => (index + 1) % tracks.length);
  };

  // Фанфары — один раз при первом показе итогов в этой игре.
  useEffect(() => {
    const previous = lastPhase.current;
    lastPhase.current = state?.phase ?? null;
    if (state?.phase !== 'finished' || previous === 'finished') return;
    const fanfare = fanfareRef.current;
    if (!fanfare) return;
    fanfare.currentTime = 0;
    fanfare.volume = 0.8;
    void fanfare.play().catch(() => undefined);
  }, [state?.phase]);

  return (
    <>
      <audio
        ref={musicRef}
        className="game-music"
        src={src || undefined}
        loop={tracks.length === 1}
        preload="auto"
        onEnded={handleTrackEnded}
        aria-hidden="true"
      />
      <audio
        ref={fanfareRef}
        className="game-fanfare"
        src={fanfareUrl}
        preload="auto"
        onPlay={() => setFanfarePlaying(true)}
        onEnded={() => setFanfarePlaying(false)}
        onPause={() => setFanfarePlaying(false)}
        onError={() => setFanfarePlaying(false)}
        aria-hidden="true"
      />
    </>
  );
}
