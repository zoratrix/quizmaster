import type { GameState } from '../../../shared/types';
import { formatBalls } from '../../../shared/format';
import { Button } from '../components/Button';
import { mediaUrl } from '../lib/media';
import { useRun } from './useRun';
import type { ScreenControls } from './useGameWindowControls';
import { Standings } from './Standings';

export interface AnswersViewProps {
  state: GameState;
  screen: ScreenControls;
}

/**
 * Фаза показа правильных ответов на все вопросы раунда.
 * Ведущий комментирует ответы, затем переходит к внесению баллов.
 */
export function AnswersView({ state, screen }: AnswersViewProps) {
  const run = useRun();
  const round = state.pack.rounds[state.roundIndex];
  const roundNumber = state.roundIndex + 1;
  const questions = round?.questions ?? [];
  const isLastRound = state.roundIndex >= state.pack.rounds.length - 1;

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
            <span className="badge badge--ok">Показаны ответы</span>
            <span className="badge">{round?.title ?? 'Раунд'}</span>
          </div>
        </div>

        <div className="grow" />

        <div className="host-topbar__actions">
          <Button variant="primary" onClick={() => void run(() => window.qm.game.next())}>
            {isLastRound ? 'Внести баллы и итоги' : 'Перейти к внесению баллов'}
          </Button>
          <Button variant="ghost" onClick={screen.openGameWindow} title="Открыть или показать игровое окно">
            Игровой экран
          </Button>
          <Button variant="ghost" onClick={screen.toggleFullscreen} title="Переключить полноэкранный режим игрового окна">
            {screen.fullscreen ? 'Оконный режим' : 'Полный экран'}
          </Button>
        </div>
      </header>

      <div className="host-body host-answers">
        <section className="panel host-answers__card">
          <div className="host-answers__head">
            <div>
              <div className="panel__title">Правильные ответы раунда</div>
              <div className="small muted">
                {questions.length} {questions.length === 1 ? 'вопрос' : 'вопросов'} · ответы видны командам на игровом экране
              </div>
            </div>
            <span className="badge">{round ? formatBalls(round.questions.reduce((sum, q) => sum + q.points, 0)) : ''} за раунд</span>
          </div>
          <ol className="host-answers__list scroll">
            {questions.map((question, index) => (
              <li className="host-answer-item" key={question.id}>
                <span className="host-answer-item__num">{index + 1}</span>
                <div className="grow">
                  <div className="host-answer-item__question">{question.text || 'Текст вопроса не заполнен'}</div>
                  <div className="host-answer-item__answer">
                    <span className="host-answer-item__label">Ответ</span>
                    {question.answer || 'Правильный ответ не заполнен'}
                  </div>
                  {question.explanation?.trim() ? (
                    <div className="host-answer-item__explanation small muted">{question.explanation}</div>
                  ) : null}
                </div>
                {question.answerImage ? (
                  <img
                    className="host-answer-item__image"
                    src={mediaUrl(question.answerImage.id)}
                    alt={question.answer ? `Картинка ответа: ${question.answer}` : 'Картинка ответа'}
                    loading="lazy"
                    draggable={false}
                  />
                ) : null}
                <span className="badge">{formatBalls(question.points)}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="host-answers__side">
          <Standings state={state} />
        </aside>
      </div>
    </div>
  );
}
