import { useEffect, useRef } from 'react';
import type { Question, QuizPack } from '../../../shared/types';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { formatBalls } from '../../../shared/format';
import { MediaField } from './MediaField';

export interface QuestionEditorProps {
  pack: QuizPack;
  roundIndex: number;
  questionIndex: number;
  question: Question | null;
  onUpdate: (mutator: (question: Question) => void) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onCopy: () => void;
}

export function QuestionEditor({
  pack,
  roundIndex,
  questionIndex,
  question,
  onUpdate,
  onDuplicate,
  onDelete,
  onMove,
  onCopy
}: QuestionEditorProps) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const round = pack.rounds[roundIndex];

  useEffect(() => {
    // при переключении вопроса оставляем фокус в поле текста — так быстрее набирать
    if (question) textRef.current?.focus();
  }, [question?.id]);

  if (!question || !round) {
    return (
      <div className="empty" style={{ height: '100%' }}>
        <div className="empty__title">Вопрос не выбран</div>
        <div>Добавьте вопрос в раунд слева</div>
      </div>
    );
  }

  const hasMedia = Boolean(question.media.image || question.media.audio || question.media.video);
  const timeLimit = question.timeLimitSec;

  return (
    <div className="question-editor">
      <div className="question-editor__head">
        <div className="col">
          <div className="row gap-8">
            <span className="badge badge--accent">Раунд {roundIndex + 1}</span>
            <span className="badge">Вопрос {questionIndex + 1} из {round.questions.length}</span>
            <span className="badge badge--ok">{formatBalls(question.points)}</span>
            <span className="badge">{timeLimit} с</span>
            {hasMedia ? <span className="badge">с медиа</span> : null}
          </div>
          <h2 className="question-editor__title">{round.title}</h2>
        </div>
        <div className="row gap-6">
          <Button size="sm" variant="ghost" onClick={() => onMove(-1)} disabled={questionIndex === 0} title="Выше">
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMove(1)}
            disabled={questionIndex >= round.questions.length - 1}
            title="Ниже"
          >
            ↓
          </Button>
          <Button size="sm" onClick={onDuplicate} title="Создать копию вопроса">
            Дублировать
          </Button>
          <Button size="sm" onClick={onCopy} title="Скопировать в другой раунд">
            В другой раунд
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete}>
            Удалить
          </Button>
        </div>
      </div>

      <div className="question-editor__grid">
        <section className="card question-editor__section question-editor__section--text">
          <Field label="Текст вопроса" hint="Крупный текст, который увидят участники на экране">
            <textarea
              ref={textRef}
              className="textarea question-editor__question-text"
              rows={4}
              value={question.text}
              placeholder="Например: Какая планета Солнечной системы самая горячая?"
              onChange={(event) => onUpdate((draft) => (draft.text = event.target.value))}
            />
          </Field>
        </section>

        <section className="question-editor__params">
          <Field label="Время ответа, секунд" hint="По умолчанию 60">
            <input
              className="input input--number"
              type="number"
              min={5}
              max={3600}
              step={5}
              value={question.timeLimitSec}
              onChange={(event) =>
                onUpdate((draft) => (draft.timeLimitSec = clampNumber(event.target.value, 5, 3600, 60)))
              }
            />
          </Field>
          <Field label="Стоимость ответа, баллов" hint="Дробные значения разрешены">
            <input
              className="input input--number"
              type="number"
              min={0}
              max={1000}
              step={0.5}
              value={question.points}
              onChange={(event) =>
                onUpdate((draft) => (draft.points = clampNumber(event.target.value, 0, 1000, 1)))
              }
            />
          </Field>
        </section>

        <section className="card question-editor__section">
          <Field
            label="Правильный ответ"
            hint="Виден только ведущему в панели управления, на игровом экране появляется после показа ответа"
          >
            <textarea
              className="textarea"
              rows={2}
              value={question.answer}
              placeholder="Краткий эталонный ответ"
              onChange={(event) => onUpdate((draft) => (draft.answer = event.target.value))}
            />
          </Field>
        </section>

        <section className="card question-editor__section">
          <Field label="Пояснение (необязательно)" hint="Показывается после раскрытия ответа">
            <textarea
              className="textarea"
              rows={2}
              value={question.explanation}
              placeholder="Интересный факт или комментарий ведущего"
              onChange={(event) => onUpdate((draft) => (draft.explanation = event.target.value))}
            />
          </Field>
        </section>

        <section className="question-editor__media">
          <MediaField
            kind="image"
            asset={question.media.image}
            onChange={(asset) => onUpdate((draft) => (draft.media.image = asset))}
          />
          <MediaField
            kind="audio"
            asset={question.media.audio}
            onChange={(asset) => onUpdate((draft) => (draft.media.audio = asset))}
          />
          <MediaField
            kind="video"
            asset={question.media.video}
            onChange={(asset) => onUpdate((draft) => (draft.media.video = asset))}
          />
        </section>
      </div>
    </div>
  );
}

function clampNumber(raw: string, min: number, max: number, fallback: number): number {
  const value = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value * 1000) / 1000));
}
