import type { GameState } from '../../../shared/types';
import { formatBalls } from '../../../shared/format';
import { Button } from '../components/Button';
import { mediaUrl } from '../lib/media';
import { useRun } from './useRun';
import type { ScreenControls } from './useGameWindowControls';
import { Standings } from './Standings';
import { TimerDisplay } from './TimerDisplay';

export interface AnswersViewProps {
  state: GameState;
  screen: ScreenControls;
}

/**
 * Фаза показа правильных ответов: ответы выводятся по одному, на каждый —
 * свой таймер (по умолчанию 15 секунд). Main-процесс переключает сам,
 * ведущий может ускорить кнопкой «Следующий ответ».
 */
export function AnswersView({ state, screen }: AnswersViewProps) {
  const run = useRun();
  const round = state.pack.rounds[state.roundIndex];
  const roundNumber = state.roundIndex + 1;
  const roundTitle = round?.title.trim() || `Раунд ${roundNumber}`;
  const questions = round?.questions ?? [];
  const total = questions.length;
  const index = Math.min(Math.max(state.questionIndex, 0), Math.max(0, total - 1));
  const question = questions[index];
  const isLast = total === 0 || index >= total - 1;
  const remainingSec = Math.max(0, Math.ceil(state.timer.remainingMs / 1000));
  const answerMedia = question?.answerMedia;

  return (
    <div className="host-root">
      <header className="host-topbar panel">
        <div className="host-topbar__identity">
          <h1 className="host-topbar__title truncate" title={state.pack.title}>
            {state.pack.title}
          </h1>
          <div className="host-topbar__badges">
            <span className="badge badge--accent">
              Раунд {roundNumber}/{state.pack.rounds.length}
            </span>
            <span className="badge">
              Ответ {Math.min(index + 1, Math.max(1, total))} из {total}
            </span>
            <span className="badge">{roundTitle}</span>
            {state.paused ? <span className="badge badge--mid">Пауза</span> : null}
          </div>
        </div>

        <TimerDisplay state={state} />

        <div className="host-topbar__actions">
          <Button variant="primary" onClick={() => void run(() => window.qm.game.next())} disabled={total === 0}>
            {isLast ? 'Внести баллы и итоги' : 'Следующий ответ →'}
          </Button>
          <Button variant={state.paused ? 'primary' : 'ghost'} onClick={() => void run(() => window.qm.game.togglePause())}>
            {state.paused ? 'Продолжить' : 'Пауза'}
          </Button>
          <Button variant="ghost" onClick={screen.openGameWindow} title="Открыть или показать игровое окно">
            Игровой экран
          </Button>
        </div>
      </header>

      <div className="host-body host-answers">
        <section className="panel host-answer-single">
          <div className="host-answer-single__head">
            <div>
              <div className="panel__title">Правильные ответы</div>
              <div className="small muted">
                {roundTitle} · показ каждого ответа — {Math.max(1, Math.round(state.timer.durationMs / 1000))} с
                {state.timer.running ? ` · осталось ${remainingSec} с` : ''}
              </div>
            </div>
            {question ? <span className="badge">{formatBalls(question.points)}</span> : null}
          </div>

          {!question ? (
            <div className="host-answer-single__empty">В этом раунде нет вопросов</div>
          ) : (
            <div className="host-answer-single__body">
              <div className="host-answer-single__question">
                {question.text.trim() || 'Текст вопроса не заполнен'}
              </div>
              <div className="host-answer-single__answer">
                <span className="host-answer-single__label">Ответ</span>
                <span>{question.answer.trim() || 'Правильный ответ не заполнен'}</span>
              </div>
              {question.explanation.trim() ? (
                <div className="host-answer-single__explanation small muted">{question.explanation.trim()}</div>
              ) : null}

              {answerMedia.image ? (
                <img
                  className="host-answer-single__image"
                  src={mediaUrl(answerMedia.image.id)}
                  alt={question.answer ? `Картинка ответа: ${question.answer}` : 'Картинка ответа'}
                  draggable={false}
                />
              ) : null}
              {answerMedia.audio ? (
                <div className="host-answer-single__media">
                  <span aria-hidden="true">🎵</span> Аудио к ответу: {answerMedia.audio.fileName}
                </div>
              ) : null}
              {answerMedia.video ? (
                <div className="host-answer-single__media">
                  <span aria-hidden="true">🎬</span> Видео к ответу: {answerMedia.video.fileName}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside className="host-answers__side">
          <Standings state={state} />
        </aside>
      </div>
    </div>
  );
}
