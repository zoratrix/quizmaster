import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import '../styles/host.css';
import type { RecoveryInfo } from '../../../shared/api';
import { useGameState } from '../hooks/useGameState';
import { Button } from '../components/Button';
import { useRun } from './useRun';
import { useGameWindowControls } from './useGameWindowControls';
import { RecoveryBanner } from './RecoveryBanner';
import { LobbyView } from './LobbyView';
import { GameView } from './GameView';
import { HandInView } from './HandInView';
import { AnswersView } from './AnswersView';
import { RoundSummaryView } from './RoundSummaryView';
import { ResultsView } from './ResultsView';
import { MusicControls } from './MusicControls';

/**
 * Панель ведущего: единственное место, где вносятся баллы и управляется ход игры.
 * Роутинг по фазе состояния из main-процесса.
 */
export function HostApp() {
  const state = useGameState();
  const run = useRun();
  const screen = useGameWindowControls();
  const [recovery, setRecovery] = useState<RecoveryInfo | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  const refreshRecovery = useCallback(async (): Promise<void> => {
    try {
      setRecovery(await window.qm.game.recoveryInfo());
    } catch {
      setRecovery(null);
    }
  }, []);

  // Баннер восстановления актуален на экране запуска и в лобби.
  const phaseKey = state ? state.phase : 'none';
  useEffect(() => {
    if (phaseKey === 'lobby' || phaseKey === 'none') void refreshRecovery();
  }, [phaseKey, refreshRecovery]);

  const handleRecover = useCallback(async (): Promise<void> => {
    setRecoveryBusy(true);
    const succeeded = await run(() => window.qm.game.recover());
    if (succeeded) setRecovery(null);
    setRecoveryBusy(false);
  }, [run]);

  const handleDiscardRecovery = useCallback(async (): Promise<void> => {
    setRecoveryBusy(true);
    const succeeded = await run(() => window.qm.game.discardRecovery());
    if (succeeded) setRecovery(null);
    setRecoveryBusy(false);
  }, [run]);

  const musicCount = state?.pack.music?.length ?? 0;
  const hasMusic = musicCount > 0;

  // Панель музыки нужна на каждом экране, поэтому оборачиваем разметку экрана.
  const withMusic = (node: ReactNode): ReactElement => (
    <>
      {node}
      <MusicControls hasMusic={hasMusic} musicCount={musicCount} />
    </>
  );

  if (!state) {
    return withMusic(
      <div className="host-root host-root--empty">
        {recovery ? (
          <RecoveryBanner
            info={recovery}
            busy={recoveryBusy}
            onRecover={() => void handleRecover()}
            onDiscard={() => void handleDiscardRecovery()}
          />
        ) : null}
        <div className="host-empty">
          <div className="host-empty__icon" aria-hidden="true">
            🎯
          </div>
          <h1 className="host-empty__title">Игра не запущена</h1>
          <p className="host-empty__text muted">
            Откройте пак в редакторе и нажмите «Запустить игру» — панель ведущего и игровое окно откроются
            автоматически.
          </p>
          <div className="host-empty__actions">
            <Button
              variant="primary"
              size="lg"
              onClick={() => void run(() => window.qm.game.openEditorWindow())}
            >
              Открыть редактор
            </Button>
          </div>
          <div className="host-empty__hint small dim">
            Это окно обновляется само, как только игра будет запущена.
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'lobby') {
    return withMusic(
      <LobbyView
        state={state}
        screen={screen}
        recovery={recovery}
        recoveryBusy={recoveryBusy}
        onRecover={() => void handleRecover()}
        onDiscardRecovery={() => void handleDiscardRecovery()}
      />
    );
  }

  if (state.phase === 'round-intro' || state.phase === 'question' || state.phase === 'round-review') {
    return withMusic(<GameView state={state} screen={screen} />);
  }

  if (state.phase === 'round-handin') {
    return withMusic(<HandInView state={state} screen={screen} />);
  }

  if (state.phase === 'round-answers') {
    return withMusic(<AnswersView state={state} screen={screen} />);
  }

  if (state.phase === 'round-summary') {
    return withMusic(<RoundSummaryView state={state} screen={screen} />);
  }

  if (state.phase === 'finished') {
    return withMusic(<ResultsView state={state} screen={screen} />);
  }

  return withMusic(null);
}
