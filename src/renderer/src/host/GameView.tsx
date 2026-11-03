import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../../shared/types';
import { formatBalls } from '../../../shared/format';
import { formatScore } from '../../../shared/scoring';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/Modal';
import { cx } from '../lib/cx';
import { useRun } from './useRun';
import { useScoreCommands } from './useScoreCommands';
import type { ScreenControls } from './useGameWindowControls';
import { TimerDisplay } from './TimerDisplay';
import { ScoreTable } from './ScoreTable';
import { ScorePanel, ScorePanelIdle } from './ScorePanel';
import { Standings } from './Standings';
import { QuestionCard } from './QuestionCard';
import {
  findQuestion,
  modeLabel,
  progressPercent,
  roundProgress,
  scoreAt,
  shortModeLabel,
  type CellRef
} from './helpers';

export interface GameViewProps {
  state: GameState;
  screen: ScreenControls;
}

type ConfirmAction = 'skip' | 'end-round' | null;

/**
 * Основной режим ведущего: заставка раунда и вопросы.
 * Слева — карточка вопроса и навигация, в центре — таблица баллов раунда,
 * справа — живой общий счёт.
 */
export function GameView({ state, screen }: GameViewProps) {
  const run = useRun();
  const score = useScoreCommands();
  const [tabRound, setTabRound] = useState(state.roundIndex);
  const [selected, setSelected] = useState<CellRef | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const lastRoundRef = useRef(state.roundIndex);

  const rounds = state.pack.rounds;
  const activeRound = rounds[state.roundIndex] ?? rounds[0];
  const isReview = state.phase === 'round-review';
  const activeQuestion =
    state.phase === 'question' || state.phase === 'round-review'
      ? activeRound?.questions[state.questionIndex] ?? null
      : null;

  // Смена раунда переключает таблицу на актуальный раунд и сбрасывает выбор.
  useEffect(() => {
    if (lastRoundRef.current === state.roundIndex) return;
    lastRoundRef.current = state.roundIndex;
    setTabRound(state.roundIndex);
    setSelected(null);
  }, [state.roundIndex]);

  const round = rounds[tabRound] ?? activeRound;
  const isCurrentRound = tabRound === state.roundIndex;
  const progress = roundProgress(state.scores, round, state.teams);
  const percent = progressPercent(progress.entered, progress.total);
  const roundPoints = round.questions.reduce((sum, question) => sum + Math.max(0, question.points), 0);

  const located = selected ? findQuestion(state.pack, selected.questionId) : null;
  const selectedTeam = selected ? state.teams.find((team) => team.id === selected.teamId) ?? null : null;
  const selectedQuestion = located?.question ?? null;
  const selectedValue =
    selected && selectedQuestion ? scoreAt(state.scores, selected.teamId, selectedQuestion.id) : undefined;
  const selectedRoundTitle = located ? rounds[located.roundIndex]?.title ?? '' : '';

  const changeTab = (index: number): void => {
    setTabRound(index);
    if (selected && !(rounds[index]?.questions ?? []).some((question) => question.id === selected.questionId)) {
      setSelected(null);
    }
  };

  const goNext = (): void => {
    void run(() => window.qm.game.next());
  };

  const goPrev = (): void => {
    void run(() => window.qm.game.prev());
  };

  const togglePause = (): void => {
    void run(() => window.qm.game.togglePause());
  };


  const requestEndRound = (): void => {
    const questions = activeRound?.questions ?? [];
    const isLastQuestion = state.phase === 'question' && state.questionIndex >= questions.length - 1;
    if (state.phase === 'round-intro' || !isLastQuestion) {
      setConfirmAction('end-round');
      return;
    }
    void run(() => window.qm.game.endRound());
  };

  const requestSkip = (): void => {
    if (state.phase !== 'question') return;
    setConfirmAction('skip');
  };

  const applyConfirm = (): void => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'skip') void run(() => window.qm.game.skip());
    if (action === 'end-round') void run(() => window.qm.game.endRound());
  };

  const applyScore = (action: 'set' | 'add', value: number): void => {
    if (!selected) return;
    score(selected, action, value);
  };

  return (
    <div className="host-root">
      <header className="host-topbar panel">
        <div className="host-topbar__identity">
          <h1 className="host-topbar__title truncate" title={state.pack.title}>
            {state.pack.title}
          </h1>
          <div className="host-topbar__badges">
            <span className="badge badge--accent">
              Раунд {state.roundIndex + 1}/{rounds.length}
            </span>
            {state.phase === 'round-intro' ? (
              <span className="badge">Заставка раунда</span>
            ) : (
              <span className="badge">
                Вопрос {state.questionIndex + 1}/{activeRound?.questions.length ?? 0}
              </span>
            )}
            <span className="badge">{shortModeLabel(state.mode)}</span>
            {isReview ? <span className="badge badge--accent">Повторный показ</span> : null}
            {state.paused ? <span className="badge badge--mid">Пауза</span> : null}
          </div>
        </div>

        <TimerDisplay state={state} />

        <div className="host-topbar__actions">
          <Button variant={state.paused ? 'primary' : 'ghost'} onClick={togglePause}>
            {state.paused ? 'Продолжить' : 'Пауза'}
          </Button>

          <Button variant="ghost" onClick={screen.openGameWindow} title="Открыть или показать игровое окно">
            Игровой экран
          </Button>
          <Button
            variant="ghost"
            onClick={screen.toggleFullscreen}
            title="Переключить полноэкранный режим игрового окна"
          >
            {screen.fullscreen ? 'Оконный режим' : 'Полный экран'}
          </Button>
        </div>
      </header>

      {isReview ? (
        <div className="host-phase-banner">
          <span className="badge badge--accent">Повторный показ</span>
          <span className="grow">
            Вопросы показываются ещё раз по 15 секунд — команды могут поправить бланки. Кнопка «Дальше»
            ускоряет просмотр, после последнего вопроса сразу начнётся сдача бланков.
          </span>
        </div>
      ) : null}
      <div className="host-body">
        <aside className="host-left">
          <QuestionCard
            state={state}
            round={activeRound}
            question={activeQuestion}
            questionNumber={Math.max(1, state.questionIndex + 1)}
            onPrev={goPrev}
            onNext={goNext}
            onSkip={requestSkip}
            onEndRound={requestEndRound}
            review={isReview}
          />
        </aside>

        <main className="host-center">
          <div className="host-rounds">
            <span className="host-rounds__label small dim">Раунды</span>
            <div className="host-rounds__tabs scroll">
              {rounds.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={cx(
                    'round-tab',
                    index === tabRound && 'is-active',
                    index === state.roundIndex && 'is-current'
                  )}
                  onClick={() => changeTab(index)}
                  title={item.title}
                >
                  Раунд {index + 1}
                  {index === state.roundIndex ? <span className="round-tab__mark" aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
            <span className="host-rounds__name truncate small muted" title={round.title}>
              {round.title}
            </span>
          </div>

          <ScoreTable
            round={round}
            teams={state.teams}
            state={state}
            currentQuestionId={isCurrentRound ? activeQuestion?.id ?? null : null}
            selected={selected}
            onSelect={setSelected}
          />

          <div className="host-progress">
            <span className="small muted">
              Внесено <b className="tabular">{progress.entered}</b> из{' '}
              <b className="tabular">{progress.total}</b> оценок
            </span>
            <div className="host-progress__bar" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </div>
            {!isCurrentRound ? (
              <>
                <span className="badge badge--mid">
                  Раунд {tabRound + 1} — редактирование
                </span>
                <Button size="sm" variant="ghost" onClick={() => changeTab(state.roundIndex)}>
                  К текущему раунду
                </Button>
              </>
            ) : (
              <span className="badge">максимум {formatBalls(roundPoints)} за раунд</span>
            )}
          </div>

          {selectedTeam && selectedQuestion && located ? (
            <ScorePanel
              team={selectedTeam}
              question={selectedQuestion}
              questionNumber={located.questionIndex + 1}
              roundTitle={selectedRoundTitle}
              value={selectedValue}
              onSet={(value) => applyScore('set', value)}
              onAdd={(delta) => applyScore('add', delta)}
            />
          ) : (
            <ScorePanelIdle />
          )}
        </main>

        <aside className="host-right">
          <Standings state={state} />
          <div className="panel host-hint">
            <div className="panel__title">Подсказка</div>
            <div className="small dim">
              {modeLabel(state.mode)}. Клик по ячейке — и сразу вводите баллы. Кнопки «Верно», «Частично»,
              «Неверно» ставят оценку одним нажатием. Переключайтесь между раундами, чтобы исправить прошлые
              результаты.
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmAction === 'skip'}
        title="Пропустить вопрос?"
        message={
          state.questionIndex >= (activeRound?.questions.length ?? 1) - 1 ? (
            <>Это последний вопрос раунда. После пропуска раунд завершится, и вы перейдёте к результатам.</>
          ) : (
            <>
              Вопрос {state.questionIndex + 1} будет отмечен как пропущенный и не пойдёт в статистику. Перейти к
              следующему?
            </>
          )
        }
        confirmLabel="Пропустить"
        danger
        onConfirm={applyConfirm}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'end-round'}
        title="Завершить раунд досрочно?"
        message="В раунде остались вопросы. Раунд завершится, и вы перейдёте к внесению результатов. Продолжить?"
        confirmLabel="Завершить раунд"
        danger
        onConfirm={applyConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
