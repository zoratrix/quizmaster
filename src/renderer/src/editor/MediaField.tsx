import { useEffect, useRef, useState } from 'react';
import type { MediaAsset, MediaKind } from '../../../shared/types';
import { mediaUrl } from '../lib/media';
import { formatBytes } from '../../../shared/format';
import { Button } from '../components/Button';
import { useToast } from '../components/Toasts';

export interface MediaFieldProps {
  kind: MediaKind;
  asset: MediaAsset | null;
  onChange: (asset: MediaAsset | null) => void;
  /** Заголовок поля. По умолчанию — стандартный для типа медиа. */
  title?: string;
  /** Подсказка, пока файл не выбран. По умолчанию — поддерживаемые форматы. */
  hint?: string;
  /** Текст пустого состояния вместо «Добавить …». */
  addLabel?: string;
}

const LABELS: Record<MediaKind, { title: string; add: string; hint: string; icon: string }> = {
  image: {
    title: 'Изображение',
    add: 'Добавить изображение',
    hint: 'PNG, JPG, WEBP, GIF',
    icon: '🖼'
  },
  audio: {
    title: 'Аудио',
    add: 'Добавить аудио',
    hint: 'MP3, WAV, OGG',
    icon: '🎵'
  },
  video: {
    title: 'Видео',
    add: 'Добавить видео',
    hint: 'MP4, WEBM',
    icon: '🎬'
  }
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function MediaField({ kind, asset, onChange, title, hint, addLabel }: MediaFieldProps) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const label = LABELS[kind];
  const fieldTitle = title ?? label.title;
  const fieldHint = hint ?? label.hint;
  const emptyLabel = addLabel ?? label.add;

  async function pick(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const next = await window.qm.pack.addMedia(kind);
      if (next) onChange(next);
    } catch (error) {
      toast.error(`Не удалось добавить файл: ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`media-field media-field--${kind}`}>
      <div className="media-field__head">
        <span className="media-field__icon" aria-hidden>
          {label.icon}
        </span>
        <div className="grow">
          <div className="media-field__title">{fieldTitle}</div>
          <div className="media-field__hint small dim">
            {asset ? `${asset.fileName} · ${formatBytes(asset.size)}` : fieldHint}
          </div>
        </div>
        {asset ? (
          <div className="row gap-6">
            <Button size="sm" variant="ghost" onClick={pick} disabled={busy}>
              Заменить
            </Button>
            <Button size="sm" variant="danger" onClick={() => onChange(null)}>
              Удалить
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={pick} disabled={busy}>
            {busy ? 'Выбор…' : 'Добавить'}
          </Button>
        )}
      </div>

      {asset ? (
        <div className="media-field__body">
          {kind === 'image' ? (
            <img className="media-field__image" src={mediaUrl(asset.id)} alt={asset.fileName} draggable={false} />
          ) : null}
          {kind === 'audio' ? <AudioPlayer src={mediaUrl(asset.id)} /> : null}
          {kind === 'video' ? <VideoPlayer src={mediaUrl(asset.id)} /> : null}
        </div>
      ) : (
        <button type="button" className="media-field__empty" onClick={pick} disabled={busy}>
          <span className="media-field__empty-icon">{label.icon}</span>
          <span>{busy ? 'Открываем файл…' : emptyLabel}</span>
          <span className="dim small">{fieldHint}</span>
        </button>
      )}
    </div>
  );
}

function AudioPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    if (ref.current) ref.current.loop = loop;
  }, [loop]);

  function toggle(): void {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }

  return (
    <div className="audio-player">
      <audio
        ref={ref}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
      />
      <button type="button" className="audio-player__play" onClick={toggle} aria-label={playing ? 'Пауза' : 'Играть'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <input
        className="audio-player__seek"
        type="range"
        min={0}
        max={Math.max(0.1, duration)}
        step={0.1}
        value={Math.min(current, duration || 0)}
        onChange={(event) => {
          const audio = ref.current;
          if (!audio) return;
          const value = Number(event.target.value);
          audio.currentTime = value;
          setCurrent(value);
        }}
      />
      <span className="mono small dim nowrap">
        {formatTime(current)} / {formatTime(duration)}
      </span>
      <Button size="sm" variant={loop ? 'primary' : 'ghost'} onClick={() => setLoop((v) => !v)} title="Повторять">
        🔁
      </Button>
    </div>
  );
}

function VideoPlayer({ src }: { src: string }) {
  const [loop, setLoop] = useState(false);
  return (
    <div className="video-player">
      <video key={src} className="video-player__video" src={src} controls loop={loop} preload="metadata" />
      <div className="row gap-8" style={{ padding: '8px 10px' }}>
        <Button size="sm" variant={loop ? 'primary' : 'ghost'} onClick={() => setLoop((v) => !v)}>
          {loop ? 'Повтор включён' : 'Повторять'}
        </Button>
        <span className="small dim">Можно перематывать и ставить на паузу</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}
