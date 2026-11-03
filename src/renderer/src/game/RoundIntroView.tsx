import type { GameState, Round } from '../../../shared/types';
import { plural } from '../../../shared/stats';
import { roundTitleSize } from './textFit';

/** Заставка раунда: «РАУНД N», название раунда и подсказка «Приготовьтесь». */
export function RoundIntroView({ state, round }: { state: GameState; round: Round }) {
  const number = state.roundIndex + 1;
  const totalRounds = state.pack.rounds.length;
  const questions = round.questions.length;
  const roundTitle = round.title.trim() || `Раунд ${number}`;

  return (
    <section className="game-screen game-screen--round-intro">
      <div className="game-round-intro">
        <div className="game-round-intro__rings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="game-round-intro__kicker">
          {state.pack.title.trim() || 'QuizMaster'} · Раунд {number} из {totalRounds}
        </div>

        <div className="game-round-intro__headline">
          <span className="game-round-intro__word">Раунд</span>
          <span className="game-round-intro__number tabular">{number}</span>
        </div>

        <h1 className="game-round-intro__title" style={{ fontSize: roundTitleSize(roundTitle.length) }}>
          {roundTitle}
        </h1>

        <div className="game-round-intro__meta">
          <span className="game-round-intro__count">
            {questions} {plural(questions, 'вопрос', 'вопроса', 'вопросов')} в раунде
          </span>
        </div>

        <div className="game-round-intro__hint">Приготовьтесь</div>
      </div>
    </section>
  );
}
