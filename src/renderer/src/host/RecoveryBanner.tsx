import type { RecoveryInfo } from '../../../shared/api';
import { formatDateTime } from '../../../shared/format';
import { Button } from '../components/Button';

export interface RecoveryBannerProps {
  info: RecoveryInfo;
  busy?: boolean;
  onRecover: () => void;
  onDiscard: () => void;
}

function placeLabel(info: RecoveryInfo): string {
  const round = `раунд ${info.roundNumber}`;
  if (info.phase === 'round-intro' || info.questionNumber <= 0) {
    return `${round}, заставка раунда`;
  }
  return `${round}, вопрос ${info.questionNumber}`;
}

/** Баннер найденной незавершённой игры с восстановлением или удалением. */
export function RecoveryBanner({ info, busy, onRecover, onDiscard }: RecoveryBannerProps) {
  return (
    <div className="panel recovery-banner">
      <div className="recovery-banner__icon" aria-hidden="true">
        ⏱
      </div>
      <div className="recovery-banner__body">
        <div className="recovery-banner__title">Найдена незавершённая игра</div>
        <div className="muted small">
          «{info.title}» · {placeLabel(info)} · сохранена {formatDateTime(info.savedAt)}
        </div>
        {info.teams.length > 0 ? (
          <div className="dim small recovery-banner__teams">Команды: {info.teams.join(', ')}</div>
        ) : null}
      </div>
      <div className="recovery-banner__actions">
        <Button variant="primary" onClick={onRecover} disabled={busy}>
          Восстановить
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={busy}>
          Удалить
        </Button>
      </div>
    </div>
  );
}
