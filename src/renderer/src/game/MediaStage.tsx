import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject
} from 'react';
import type { MediaAsset, QuestionMedia } from '../../../shared/types';
import { formatClock } from '../../../shared/format';
import { mediaUrl } from '../lib/media';
import { cx } from '../lib/cx';

/**
 * Ставит медиа на паузу вместе с игрой и продолжает воспроизведение с того же
 * места после снятия паузы. Позиция не сбрасывается — элементы не пересоздаются.
 */
function useMediaPlayback(ref: RefObject<HTMLMediaElement | null>, paused: boolean): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (paused) {
      element.pause();
    } else {
      void element.play().catch(() => undefined);
    }
  }, [paused, ref]);
}

function MediaFallback({ label }: { label: string }) {
  return (
    <div className="game-media__fallback">
      <span className="game-media__fallback-icon" aria-hidden="true">
        !
      </span>
      {label}
    </div>
  );
}

function ImageStage({ asset }: { asset: MediaAsset }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <MediaFallback label="Изображение недоступно" />;

  return (
    <div className="game-media__visual">
      <img
        className="game-media__image"
        src={mediaUrl(asset.id)}
        alt="Иллюстрация к вопросу"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function VideoStage({ asset, paused }: { asset: MediaAsset; paused: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);

  useMediaPlayback(ref, paused);

  if (failed) return <MediaFallback label="Видео недоступно" />;

  return (
    <div className="game-media__visual">
      <video
        ref={ref}
        className="game-media__video"
        src={mediaUrl(asset.id)}
        controls
        autoPlay
        playsInline
        preload="auto"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

const WAVE_DELAYS = [0, 140, 280, 70, 210, 350];

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M8 5.4v13.2L19 12z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M6.8 5h3.9v14H6.8zM13.3 5h3.9v14h-3.9z" />
    </svg>
  );
}

function IconReplay() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    </svg>
  );
}

/** Аккуратный аудио-плеер: большая кнопка, шкала, время и кнопка повтора. */
function AudioPlayer({ asset, paused }: { asset: MediaAsset; paused: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  useMediaPlayback(audioRef, paused);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    const onPlay = (): void => setPlaying(true);
    const onPause = (): void => setPlaying(false);
    const onTimeUpdate = (): void => setCurrent(element.currentTime);
    const onMeta = (): void => setDuration(Number.isFinite(element.duration) ? element.duration : 0);
    const onEnded = (): void => {
      setPlaying(false);
      setCurrent(Number.isFinite(element.duration) ? element.duration : 0);
    };

    element.addEventListener('play', onPlay);
    element.addEventListener('pause', onPause);
    element.addEventListener('timeupdate', onTimeUpdate);
    element.addEventListener('loadedmetadata', onMeta);
    element.addEventListener('durationchange', onMeta);
    element.addEventListener('ended', onEnded);

    setPlaying(!element.paused);
    setDuration(Number.isFinite(element.duration) ? element.duration : 0);

    return () => {
      element.removeEventListener('play', onPlay);
      element.removeEventListener('pause', onPause);
      element.removeEventListener('timeupdate', onTimeUpdate);
      element.removeEventListener('loadedmetadata', onMeta);
      element.removeEventListener('durationchange', onMeta);
      element.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggle = (): void => {
    const element = audioRef.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  };

  const replay = (): void => {
    const element = audioRef.current;
    if (!element) return;
    element.currentTime = 0;
    setCurrent(0);
    void element.play().catch(() => undefined);
  };

  const seekTo = (clientX: number): void => {
    const element = audioRef.current;
    const track = trackRef.current;
    if (!element || !track) return;
    const total = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : duration;
    if (!total) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    element.currentTime = ratio * total;
    setCurrent(element.currentTime);
  };

  const onTrackClick = (event: ReactMouseEvent<HTMLDivElement>): void => seekTo(event.clientX);

  const onTrackKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const element = audioRef.current;
    if (!element) return;
    const step = event.key === 'ArrowLeft' ? -5 : 5;
    const total = Number.isFinite(element.duration) ? element.duration : duration;
    element.currentTime = Math.min(total, Math.max(0, element.currentTime + step));
  };

  if (failed) return <MediaFallback label="Аудио недоступно" />;

  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div className={cx('game-audio', playing && 'game-audio--playing')}>
      <audio
        ref={audioRef}
        className="game-audio__el"
        src={mediaUrl(asset.id)}
        preload="auto"
        onError={() => setFailed(true)}
      />

      <div className="game-audio__art" aria-hidden="true">
        {WAVE_DELAYS.map((delay, index) => (
          <span className="game-audio__bar" key={index} style={{ animationDelay: `${delay}ms` }} />
        ))}
        <span className="game-audio__note">{playing ? 'Воспроизведение' : 'Аудиовопрос'}</span>
      </div>

      <div className="game-audio__controls">
        <button
          type="button"
          className="game-audio__btn game-audio__btn--play"
          onClick={toggle}
          aria-label={playing ? 'Приостановить аудио' : 'Воспроизвести аудио'}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>

        <div className="game-audio__center">
          <div
            ref={trackRef}
            className="game-audio__track"
            role="slider"
            tabIndex={0}
            aria-label="Позиция воспроизведения"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(current)}
            aria-valuetext={`${formatClock(current * 1000)} из ${formatClock(duration * 1000)}`}
            onClick={onTrackClick}
            onKeyDown={onTrackKeyDown}
          >
            <div className="game-audio__fill" style={{ width: `${percent}%` }} />
            <div className="game-audio__thumb" style={{ left: `${percent}%` }} />
          </div>
          <div className="game-audio__time tabular">
            <span>{formatClock(current * 1000)}</span>
            <span className="game-audio__duration">{formatClock(duration * 1000)}</span>
          </div>
        </div>

        <button type="button" className="game-audio__btn" onClick={replay} aria-label="Повторить аудио с начала">
          <IconReplay />
        </button>
      </div>
    </div>
  );
}

export interface MediaStageProps {
  media: QuestionMedia;
  paused: boolean;
}

/**
 * Медиа-зона вопроса: изображение, видео или аудио-плеер.
 * При смене вопроса компонент пересоздаётся (key по question.id), поэтому
 * воспроизведение начинается заново.
 */
export function MediaStage({ media, paused }: MediaStageProps) {
  const hasVisual = Boolean(media.video || media.image);
  const hasAudio = Boolean(media.audio);
  if (!hasVisual && !hasAudio) return null;

  return (
    <div className={cx('game-media', !hasVisual && 'game-media--audio-only')}>
      {media.video ? <VideoStage key={media.video.id} asset={media.video} paused={paused} /> : null}
      {!media.video && media.image ? <ImageStage key={media.image.id} asset={media.image} /> : null}
      {media.audio ? <AudioPlayer key={media.audio.id} asset={media.audio} paused={paused} /> : null}
    </div>
  );
}
