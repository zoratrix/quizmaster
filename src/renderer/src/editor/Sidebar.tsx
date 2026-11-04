import type { QuizPack } from '../../../shared/types';
import { Button } from '../components/Button';
import { formatBalls, truncate } from '../../../shared/format';
import { mediaUrl } from '../lib/media';

export interface RoundsPanelProps {
  pack: QuizPack;
  roundIndex: number;
  onSelectRound: (index: number) => void;
  onAddRound: () => void;
  onMoveRound: (index: number, direction: -1 | 1) => void;
  onDeleteRound: (index: number) => void;
  onOpenSettings: () => void;
  onOpenDemos: () => void;
}

export function RoundsPanel({
  pack,
  roundIndex,
  onSelectRound,
  onAddRound,
  onMoveRound,
  onDeleteRound,
  onOpenSettings,
  onOpenDemos
}: RoundsPanelProps) {
  const totalQuestions = pack.rounds.reduce((sum, round) => sum + round.questions.length, 0);

  return (
    <aside className="rails-panel rails-panel--rounds">
      <div className="rails-panel__head">
        <div className="col">
          <span className="panel__title">Раунды</span>
          <span className="small dim">
            {pack.rounds.length} · {totalQuestions} вопр.
          </span>
        </div>
        <Button size="sm" variant="primary" onClick={onAddRound} title="Добавить раунд">
          + Раунд
        </Button>
      </div>

      <div className="rails-panel__list scroll">
        {pack.rounds.map((round, index) => (
          <div
            key={round.id}
            className={`round-item${index === roundIndex ? ' is-active' : ''}`}
            onClick={() => onSelectRound(index)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelectRound(index);
            }}
          >
            <span className="round-item__number">{index + 1}</span>
            <div className="grow">
              <div className="round-item__title truncate">{round.title || `Раунд ${index + 1}`}</div>
              <div className="small dim">{round.questions.length} вопросов</div>
            </div>
            <div className="round-item__actions">
              <button
                className="mini-btn"
                title="Выше"
                disabled={index === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  onMoveRound(index, -1);
                }}
              >
                ↑
              </button>
              <button
                className="mini-btn"
                title="Ниже"
                disabled={index === pack.rounds.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  onMoveRound(index, 1);
                }}
              >
                ↓
              </button>
              <button
                className="mini-btn mini-btn--danger"
                title="Удалить раунд"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteRound(index);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rails-panel__foot col gap-6">
        <Button size="sm" variant="ghost" onClick={onOpenSettings}>
          ⚙ Настройки пака
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenDemos}>
          📦 Демо-паки
        </Button>
      </div>
    </aside>
  );
}

export interface QuestionsPanelProps {
  pack: QuizPack;
  roundIndex: number;
  questionIndex: number;
  onSelectQuestion: (index: number) => void;
  onRenameRound: (title: string) => void;
  onPickRoundCover: () => void;
  onClearRoundCover: () => void;
  onAddQuestion: () => void;
  onDuplicateQuestion: () => void;
  onDeleteQuestion: () => void;
  onMoveQuestion: (direction: -1 | 1) => void;
  onCopyQuestion: () => void;
}

export function QuestionsPanel({
  pack,
  roundIndex,
  questionIndex,
  onSelectQuestion,
  onRenameRound,
  onPickRoundCover,
  onClearRoundCover,
  onAddQuestion,
  onDuplicateQuestion,
  onDeleteQuestion,
  onMoveQuestion,
  onCopyQuestion
}: QuestionsPanelProps) {
  const round = pack.rounds[roundIndex];
  if (!round) return null;
  const hasQuestion = Boolean(round.questions[questionIndex]);

  return (
    <aside className="rails-panel rails-panel--questions">
      <div className="rails-panel__head rails-panel__head--stack">
        <input
          className="input round-title-input"
          value={round.title}
          placeholder="Название раунда"
          onChange={(event) => onRenameRound(event.target.value)}
          title="Название раунда — редактируется здесь"
        />
        {round.cover ? (
          <div className="round-cover">
            <div className="round-cover__preview">
              <img
                className="round-cover__thumb"
                src={mediaUrl(round.cover.id)}
                alt=""
                draggable={false}
              />
              <div className="grow">
                <div className="round-cover__title">Обложка раунда</div>
                <div className="round-cover__meta small dim truncate" title={round.cover.fileName}>
                  {round.cover.fileName}
                </div>
              </div>
            </div>
            <div className="round-cover__actions">
              <Button size="sm" variant="ghost" onClick={onPickRoundCover}>
                Заменить
              </Button>
              <Button size="sm" variant="danger" onClick={onClearRoundCover}>
                Удалить
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" block onClick={onPickRoundCover}>
            Добавить обложку
          </Button>
        )}
        <div className="row row--between">
          <span className="small dim">Вопросы раунда</span>
          <Button size="sm" variant="primary" onClick={onAddQuestion}>
            + Вопрос
          </Button>
        </div>
      </div>

      <div className="rails-panel__list scroll">
        {round.questions.length === 0 ? (
          <div className="empty">
            <div className="empty__title">В раунде нет вопросов</div>
            <Button size="sm" variant="primary" onClick={onAddQuestion}>
              Добавить вопрос
            </Button>
          </div>
        ) : (
          round.questions.map((question, index) => {
            const media = [
              question.media.image,
              question.media.audio,
              question.media.video,
              question.answerMedia.image,
              question.answerMedia.audio,
              question.answerMedia.video
            ].filter(Boolean).length;
            const empty = !question.text.trim();
            return (
              <div
                key={question.id}
                className={`question-item${index === questionIndex ? ' is-active' : ''}${empty ? ' is-empty' : ''}`}
                onClick={() => onSelectQuestion(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelectQuestion(index);
                }}
              >
                <span className="question-item__number">{index + 1}</span>
                <div className="grow">
                  <div className="question-item__text">
                    {question.text.trim() ? truncate(question.text.replace(/\s+/g, ' '), 90) : 'Без текста вопроса'}
                  </div>
                  <div className="question-item__meta">
                    <span className="badge badge--ok">{formatBalls(question.points)}</span>
                    <span className="badge">{question.timeLimitSec} с</span>
                    {media > 0 ? <span className="badge">📎 {media}</span> : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rails-panel__foot row gap-6">
        <Button size="sm" variant="ghost" onClick={() => onMoveQuestion(-1)} disabled={!hasQuestion || questionIndex === 0} title="Выше">
          ↑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onMoveQuestion(1)}
          disabled={!hasQuestion || questionIndex >= round.questions.length - 1}
          title="Ниже"
        >
          ↓
        </Button>
        <Button size="sm" variant="ghost" onClick={onDuplicateQuestion} disabled={!hasQuestion} title="Дублировать вопрос">
          ⧉
        </Button>
        <Button size="sm" variant="ghost" onClick={onCopyQuestion} disabled={!hasQuestion} title="Скопировать в другой раунд">
          📋
        </Button>
        <div className="grow" />
        <Button size="sm" variant="danger" onClick={onDeleteQuestion} disabled={!hasQuestion} title="Удалить вопрос">
          ✕
        </Button>
      </div>
    </aside>
  );
}
