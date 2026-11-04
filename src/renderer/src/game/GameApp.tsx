import type { ReactNode } from 'react';
import type { GameState, Question, Round } from '../../../shared/types';
import { themeScheme } from '../../../shared/themes';
import { useGameState, useTimerRemaining } from '../hooks/useGameState';
import { IdleSplash } from './IdleSplash';
import { LobbyView } from './LobbyView';
import { RoundIntroView } from './RoundIntroView';
import { QuestionView } from './QuestionView';
import { RoundReviewView } from './RoundReviewView';
import { RoundHandInView } from './RoundHandInView';
import { RoundAnswersView } from './RoundAnswersView';
import { RoundSummaryView } from './RoundSummaryView';
import { ResultsView } from './ResultsView';
import { PauseOverlay } from './PauseOverlay';
import { GameHint } from './GameHint';
import { BackgroundMusic } from './BackgroundMusic';
import { useGameFullscreen } from './useGameFullscreen';
import '../styles/game.css';

interface CurrentQuestion {
  round: Round;
  question: Question;
}

/** Вопрос, который сейчас на экране: обычный ход или повторный просмотр перед сдачей. */
function pickQuestion(state: GameState): CurrentQuestion | null {
  if (state.phase !== 'question' && state.phase !== 'round-review') return null;
  const round = state.pack.rounds[state.roundIndex];
  if (!round) return null;
  const question = round.questions[state.questionIndex];
  if (!question) return null;
  return { round, question };
}

/**
 * Игровой экран для проектора/второго монитора. Только отображение состояния:
 * все команды приходят из main-процесса через window.qm, своих кнопок ведущего
 * здесь нет (кроме скрытой подсказки F11).
 *
 * Тема оформления берётся из пака и применяется только к этому экрану:
 * атрибут data-theme на корне выбирает блок переменных в game.css.
 */
export function GameApp() {
  useGameFullscreen();

  const state = useGameState();
  const remainingMs = useTimerRemaining(state);

  let content: ReactNode;
  if (!state) {
    content = <IdleSplash />;
  } else {
    const round = state.pack.rounds[state.roundIndex];

    switch (state.phase) {
      case 'lobby':
        content = <LobbyView key="lobby" state={state} />;
        break;

      case 'round-intro':
        content = round ? (
          <RoundIntroView key={`round-intro-${state.roundIndex}`} state={state} round={round} />
        ) : (
          <IdleSplash key="round-missing" title="Раунд не найден" subtitle="Проверьте структуру пака" />
        );
        break;

      case 'question': {
        const current = pickQuestion(state);
        content = current ? (
          <QuestionView
            key={`question-${state.roundIndex}-${state.questionIndex}`}
            state={state}
            round={current.round}
            question={current.question}
            remainingMs={remainingMs}
            ended={remainingMs <= 0}
          />
        ) : (
          <IdleSplash key="question-missing" title="Вопрос не найден" subtitle="Проверьте структуру пака" />
        );
        break;
      }

      case 'round-review': {
        const current = pickQuestion(state);
        content = current ? (
          <RoundReviewView
            key={`review-${state.roundIndex}-${state.questionIndex}`}
            state={state}
            round={current.round}
            question={current.question}
            remainingMs={remainingMs}
          />
        ) : (
          <IdleSplash key="review-missing" title="Вопрос не найден" subtitle="Проверьте структуру пака" />
        );
        break;
      }

      case 'round-handin':
        content = <RoundHandInView key={`handin-${state.roundIndex}`} state={state} remainingMs={remainingMs} />;
        break;

      case 'round-answers':
        content = <RoundAnswersView key={`answers-${state.roundIndex}`} state={state} remainingMs={remainingMs} />;
        break;

      case 'round-summary':
        content = <RoundSummaryView key={`round-summary-${state.roundIndex}`} state={state} />;
        break;

      case 'finished':
        content = <ResultsView key="results" state={state} />;
        break;

      default:
        content = <IdleSplash />;
    }
  }

  return (
    <div
      className="game-root"
      data-theme={state?.pack.theme ?? 'default'}
      data-scheme={themeScheme(state?.pack.theme ?? 'default')}
      data-phase={state?.phase ?? 'idle'}
      data-paused={state?.paused ? 'true' : 'false'}
    >
      <div className="game-root__glow" aria-hidden="true" />
      <div className="game-root__decor" aria-hidden="true" />
      <BackgroundMusic state={state} />
      {content}
      <PauseOverlay open={Boolean(state?.paused)} />
      <GameHint />
    </div>
  );
}
