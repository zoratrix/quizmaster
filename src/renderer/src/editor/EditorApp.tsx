import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoPackInfo } from '../../../shared/api';
import type { MediaAsset, MediaKind, Question, QuizPack } from '../../../shared/types';
import {
  collectMedia,
  createEmptyPack,
  createQuestion,
  createRound,
  newId,
  normalizePack
} from '../../../shared/factory';
import { formatBytes, formatDateTime } from '../../../shared/format';
import { PACK_THEMES, THEME_GROUPS, themesOfGroup } from '../../../shared/themes';
import type { ThemeId } from '../../../shared/types';
import { Button } from '../components/Button';
import { ConfirmDialog, Modal } from '../components/Modal';
import { Field } from '../components/Field';
import { useToast } from '../components/Toasts';
import { RoundsPanel, QuestionsPanel } from './Sidebar';
import { QuestionEditor } from './QuestionEditor';
import { ThemePreview } from './ThemePreview';
import { humanizeError } from '../lib/errors';
import '../styles/editor.css';

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  action: () => void;
} | null;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function packProblems(pack: QuizPack): { hard: string[]; soft: string[] } {
  const hard: string[] = [];
  const soft: string[] = [];
  if (pack.rounds.length === 0) hard.push('В паке нет ни одного раунда');
  const questions = pack.rounds.flatMap((round) => round.questions);
  if (questions.length === 0) hard.push('В паке нет ни одного вопроса');
  const noText = questions.filter((q) => !q.text.trim()).length;
  const noAnswer = questions.filter((q) => !q.answer.trim()).length;
  if (noText > 0) soft.push(`Без текста вопроса: ${noText}`);
  if (noAnswer > 0) soft.push(`Без правильного ответа: ${noAnswer}`);
  return { hard, soft };
}

export function EditorApp() {
  const toast = useToast();
  const [pack, setPack] = useState<QuizPack | null>(null);
  const [packPath, setPackPath] = useState<string | null>(null);
  const [savedJson, setSavedJson] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [demos, setDemos] = useState<DemoPackInfo[]>([]);
  const [draftLoadedAt, setDraftLoadedAt] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [demosOpen, setDemosOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargetRound, setCopyTargetRound] = useState(0);
  const runningRef = useRef(false);

  // ---------- Загрузка ----------

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const draft = await window.qm.pack.draftLoad();
        if (!alive) return;
        if (draft) {
          // Черновик мог быть сохранён в старой версии — добавляем новые поля пака.
          setPack(normalizePack(draft.pack));
          setPackPath(draft.path);
          setDraftLoadedAt(draft.savedAt);
        } else {
          const empty = createEmptyPack();
          setPack(empty);
          setSavedJson(JSON.stringify(empty));
        }
        const demoList = await window.qm.pack.listDemos();
        if (alive) setDemos(demoList);
      } catch (error) {
        if (alive) {
          const empty = createEmptyPack();
          setPack(empty);
          setSavedJson(JSON.stringify(empty));
          toast.error(`Не удалось загрузить состояние редактора: ${errorText(error)}`);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [toast]);

  useEffect(() => {
    if (!pack) return;
    setDirty(JSON.stringify(pack) !== savedJson);
  }, [pack, savedJson]);

  // автосохранение черновика
  useEffect(() => {
    if (!pack || !dirty) return;
    const timer = window.setTimeout(() => {
      void window.qm.pack
        .draftSave(pack, packPath)
        .then((result) => setAutosavedAt(result.savedAt))
        .catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [pack, packPath, dirty]);

  // ---------- Мутации ----------

  const mutatePack = useCallback((mutator: (draft: QuizPack) => void) => {
    setPack((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      mutator(next);
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }, []);

  const mutateQuestion = useCallback(
    (mutator: (question: Question) => void) => {
      setPack((prev) => {
        if (!prev) return prev;
        const next = clone(prev);
        const question = next.rounds[roundIndex]?.questions[questionIndex];
        if (!question) return prev;
        mutator(question);
        next.updatedAt = new Date().toISOString();
        return next;
      });
    },
    [roundIndex, questionIndex]
  );

  const currentRound = pack?.rounds[roundIndex] ?? null;
  const currentQuestion = currentRound?.questions[questionIndex] ?? null;

  function selectRound(index: number): void {
    setRoundIndex(index);
    setQuestionIndex(0);
  }

  function addRound(): void {
    if (!pack) return;
    const index = pack.rounds.length;
    mutatePack((draft) => {
      draft.rounds.push(createRound(index, draft.settings));
    });
    setRoundIndex(index);
    setQuestionIndex(0);
  }

  function moveRound(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (!pack || target < 0 || target >= pack.rounds.length) return;
    mutatePack((draft) => {
      const [moved] = draft.rounds.splice(index, 1);
      draft.rounds.splice(target, 0, moved);
    });
    if (roundIndex === index) setRoundIndex(target);
    else if (roundIndex === target) setRoundIndex(index);
  }

  function askDeleteRound(index: number): void {
    if (!pack) return;
    const round = pack.rounds[index];
    if (!round) return;
    if (pack.rounds.length === 1) {
      toast.error('В паке должен остаться хотя бы один раунд');
      return;
    }
    setConfirm({
      title: 'Удалить раунд?',
      message: `Раунд «${round.title}» и все его ${round.questions.length} вопросов будут удалены.`,
      confirmLabel: 'Удалить раунд',
      danger: true,
      action: () => {
        mutatePack((draft) => {
          draft.rounds.splice(index, 1);
        });
        setRoundIndex(Math.max(0, Math.min(roundIndex, (pack?.rounds.length ?? 1) - 2)));
        setQuestionIndex(0);
        toast.success('Раунд удалён');
      }
    });
  }

  async function pickRoundCover(): Promise<void> {
    const index = roundIndex;
    try {
      const asset = await window.qm.pack.addMedia('image');
      if (!asset) return;
      mutatePack((draft) => {
        const round = draft.rounds[index];
        if (round) round.cover = asset;
      });
      toast.success('Обложка раунда добавлена');
    } catch (error) {
      toast.error(`Не удалось добавить обложку: ${errorText(error)}`);
    }
  }

  function clearRoundCover(): void {
    const index = roundIndex;
    mutatePack((draft) => {
      const round = draft.rounds[index];
      if (round) round.cover = null;
    });
  }

  function addQuestion(): void {
    if (!pack) return;
    const index = currentRound?.questions.length ?? 0;
    mutatePack((draft) => {
      const round = draft.rounds[roundIndex];
      if (!round) return;
      round.questions.push(createQuestion(draft.settings));
    });
    setQuestionIndex(index);
  }

  function duplicateQuestion(): void {
    if (!pack || !currentQuestion) return;
    const copy = clone(currentQuestion);
    copy.id = newId('q');
    mutatePack((draft) => {
      draft.rounds[roundIndex]?.questions.splice(questionIndex + 1, 0, copy);
    });
    setQuestionIndex(questionIndex + 1);
    toast.success('Вопрос продублирован');
  }

  function askDeleteQuestion(): void {
    if (!pack || !currentRound || !currentQuestion) return;
    if (currentRound.questions.length === 1) {
      setConfirm({
        title: 'Очистить вопрос?',
        message: 'В раунде остался один вопрос — он будет очищен, а не удалён, чтобы раунд не остался пустым.',
        confirmLabel: 'Очистить',
        danger: true,
        action: () => {
          mutateQuestion((draft) => {
            draft.text = '';
            draft.answer = '';
            draft.explanation = '';
            draft.media = { image: null, audio: null, video: null };
          });
        }
      });
      return;
    }
    setConfirm({
      title: 'Удалить вопрос?',
      message: 'Вопрос будет удалён вместе с прикреплёнными медиа.',
      confirmLabel: 'Удалить',
      danger: true,
      action: () => {
        mutatePack((draft) => {
          draft.rounds[roundIndex]?.questions.splice(questionIndex, 1);
        });
        setQuestionIndex(Math.max(0, questionIndex - 1));
        toast.success('Вопрос удалён');
      }
    });
  }

  function moveQuestion(direction: -1 | 1): void {
    if (!currentRound) return;
    const target = questionIndex + direction;
    if (target < 0 || target >= currentRound.questions.length) return;
    mutatePack((draft) => {
      const questions = draft.rounds[roundIndex]?.questions;
      if (!questions) return;
      const [moved] = questions.splice(questionIndex, 1);
      questions.splice(target, 0, moved);
    });
    setQuestionIndex(target);
  }

  function openCopyModal(): void {
    if (!pack) return;
    const fallback = pack.rounds.length > 1 ? (roundIndex === 0 ? 1 : 0) : 0;
    setCopyTargetRound(fallback);
    setCopyOpen(true);
  }

  function copyQuestionToRound(): void {
    if (!pack || !currentQuestion) return;
    if (copyTargetRound === roundIndex) {
      toast.error('Выберите другой раунд');
      return;
    }
    const copy = clone(currentQuestion);
    copy.id = newId('q');
    mutatePack((draft) => {
      draft.rounds[copyTargetRound]?.questions.push(copy);
    });
    setCopyOpen(false);
    setRoundIndex(copyTargetRound);
    setQuestionIndex((pack.rounds[copyTargetRound]?.questions.length ?? 1) - 1 + 1);
    toast.success(`Вопрос скопирован в раунд «${pack.rounds[copyTargetRound]?.title}»`);
  }

  // ---------- Файловые операции ----------

  async function savePack(asCopy = false): Promise<QuizPack | null> {
    if (!pack || saving) return null;
    setSaving(true);
    try {
      const snapshot: QuizPack = { ...pack, updatedAt: new Date().toISOString() };
      const result = await window.qm.pack.save(snapshot, packPath, asCopy || !packPath);
      if (!result) return null;
      setPack(snapshot);
      setPackPath(result.path);
      setSavedJson(JSON.stringify(snapshot));
      setDirty(false);
      setDraftLoadedAt(null);
      if (result.issues.length > 0) {
        toast.error(`Пак сохранён с замечаниями:\n${result.issues.join('\n')}`);
      } else {
        toast.success('Пак сохранён');
      }
      void window.qm.pack.draftClear();
      return snapshot;
    } catch (error) {
      toast.error(`Не удалось сохранить пак: ${errorText(error)}`);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function openPackFrom(result: { pack: QuizPack; path: string; issues: string[] }): void {
    setPack(result.pack);
    setPackPath(result.path);
    setSavedJson(JSON.stringify(result.pack));
    setRoundIndex(0);
    setQuestionIndex(0);
    setDraftLoadedAt(null);
    if (result.issues.length > 0) {
      toast.error(`Пак открыт с замечаниями:\n${result.issues.join('\n')}`);
    } else {
      toast.success('Пак открыт');
    }
  }

  async function openPack(): Promise<void> {
    try {
      const result = await window.qm.pack.open();
      if (!result) return;
      openPackFrom(result);
    } catch (error) {
      toast.error(`Не удалось открыть пак: ${errorText(error)}`);
    }
  }

  async function openDemo(path: string): Promise<void> {
    try {
      const result = await window.qm.pack.openPath(path);
      openPackFrom(result);
      setDemosOpen(false);
    } catch (error) {
      toast.error(`Не удалось открыть демо-пак: ${errorText(error)}`);
    }
  }

  function askNewPack(): void {
    const create = (): void => {
      const empty = createEmptyPack();
      setPack(empty);
      setPackPath(null);
      setSavedJson(JSON.stringify(empty));
      setRoundIndex(0);
      setQuestionIndex(0);
      setDraftLoadedAt(null);
      void window.qm.pack.draftClear();
      toast.success('Создан новый пак');
    };
    if (dirty) {
      setConfirm({
        title: 'Создать новый пак?',
        message: 'Несохранённые изменения текущего пака будут потеряны.',
        confirmLabel: 'Создать',
        danger: true,
        action: create
      });
    } else {
      create();
    }
  }

  async function startGame(): Promise<void> {
    if (!pack || runningRef.current) return;
    const problems = packProblems(pack);
    if (problems.hard.length > 0) {
      toast.error(`Нельзя начать игру:\n${problems.hard.join('\n')}`);
      return;
    }
    runningRef.current = true;
    try {
      let current = pack;
      if (dirty || !packPath) {
        const saved = await savePack(false);
        if (!saved) return;
        current = saved;
      }
      if (problems.soft.length > 0) {
        toast.info(`Игра запускается, но проверьте пак: ${problems.soft.join('; ')}`);
      }
      await window.qm.pack.prepareGame({ pack: current, packPath });
      toast.success('Игра запущена: откройте панель ведущего и игровой экран');
    } catch (error) {
      toast.error(`Не удалось запустить игру: ${errorText(error)}`);
    } finally {
      runningRef.current = false;
    }
  }

  // ---------- Горячие клавиши ----------

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        void savePack(event.shiftKey);
      } else if (key === 'o') {
        event.preventDefault();
        void openPack();
      } else if (key === 'n') {
        event.preventDefault();
        askNewPack();
      } else if (key === 'enter') {
        event.preventDefault();
        void startGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mediaCount = pack ? collectMedia(pack).length : 0;
  const pathLabel = packPath ? packPath.split(/[\\/]/).pop() : 'не сохранён в файл';

  if (!pack) {
    return (
      <div className="empty" style={{ height: '100%' }}>
        <div className="spinner" />
        <div className="empty__title">Загрузка редактора…</div>
      </div>
    );
  }

  return (
    <div className="editor-root">
      <header className="editor-topbar">
        <div className="editor-brand">
          <span className="editor-brand__mark">Q</span>
          <div className="col">
            <input
              className="editor-brand__title"
              value={pack.title}
              onChange={(event) => mutatePack((draft) => (draft.title = event.target.value))}
              title="Название пака"
            />
            <div className="row gap-6 small">
              <span className="dim truncate" title={packPath ?? undefined}>
                {pathLabel}
              </span>
              {dirty ? (
                <span className="badge badge--mid">Не сохранено</span>
              ) : (
                <span className="badge badge--ok">Сохранено</span>
              )}
              {autosavedAt && dirty ? <span className="dim">· черновик {timeOf(autosavedAt)}</span> : null}
            </div>
          </div>
        </div>

        <div className="row gap-8">
          <Button variant="ghost" onClick={askNewPack} title="Новый пак (Ctrl+N)">
            Новый
          </Button>
          <Button variant="ghost" onClick={() => void openPack()} title="Открыть пак (Ctrl+O)">
            Открыть
          </Button>
          <Button variant="ghost" onClick={() => void savePack(true)} disabled={saving} title="Сохранить копию (Ctrl+Shift+S)">
            Сохранить как
          </Button>
          <Button onClick={() => void savePack(false)} disabled={saving} title="Сохранить (Ctrl+S)">
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
          <Button variant="primary" onClick={() => void startGame()} title="Сохранить пак и открыть окна игры (Ctrl+Enter)">
            ▶ Провести игру
          </Button>
        </div>
      </header>

      {draftLoadedAt ? (
        <div className="editor-banner">
          <span className="grow">
            Восстановлен несохранённый черновик от {formatDateTime(draftLoadedAt)}. Проверьте содержимое и сохраните пак.
          </span>
          <Button size="sm" variant="ghost" onClick={() => setDraftLoadedAt(null)}>
            Скрыть
          </Button>
        </div>
      ) : null}

      <div className="editor-body">
        <div className="editor-rails">
          <RoundsPanel
            pack={pack}
            roundIndex={roundIndex}
            onSelectRound={selectRound}
            onAddRound={addRound}
            onMoveRound={moveRound}
            onDeleteRound={askDeleteRound}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenDemos={() => setDemosOpen(true)}
          />
          <QuestionsPanel
            pack={pack}
            roundIndex={roundIndex}
            questionIndex={questionIndex}
            onSelectQuestion={setQuestionIndex}
            onRenameRound={(title) =>
              mutatePack((draft) => {
                const round = draft.rounds[roundIndex];
                if (round) round.title = title;
              })
            }
            onPickRoundCover={() => void pickRoundCover()}
            onClearRoundCover={clearRoundCover}
            onAddQuestion={addQuestion}
            onDuplicateQuestion={duplicateQuestion}
            onDeleteQuestion={askDeleteQuestion}
            onMoveQuestion={moveQuestion}
            onCopyQuestion={openCopyModal}
          />
        </div>

        <main className="editor-main scroll">
          <QuestionEditor
            pack={pack}
            roundIndex={roundIndex}
            questionIndex={questionIndex}
            question={currentQuestion}
            onUpdate={(mutator) => mutateQuestion(mutator)}
            onDuplicate={duplicateQuestion}
            onDelete={askDeleteQuestion}
            onMove={moveQuestion}
            onCopy={openCopyModal}
          />
        </main>
      </div>

      <footer className="editor-statusbar">
        <span>
          {pack.rounds.length} раундов · {pack.rounds.reduce((sum, r) => sum + r.questions.length, 0)} вопросов ·{' '}
          {mediaCount} медиа
        </span>
        <span className="dim">Ctrl+S — сохранить · Ctrl+Enter — провести игру · Ctrl+O — открыть</span>
      </footer>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onConfirm={() => {
          const action = confirm?.action;
          setConfirm(null);
          action?.();
        }}
        onCancel={() => setConfirm(null)}
      />

      <PackSettingsModal
        open={settingsOpen}
        pack={pack}
        onClose={() => setSettingsOpen(false)}
        onApply={(values) => {
          mutatePack((draft) => {
            draft.title = values.title;
            draft.description = values.description;
            draft.theme = values.theme;
            draft.music = values.music;
            draft.settings.defaultTimeLimitSec = values.defaultTimeLimitSec;
            draft.settings.defaultPoints = values.defaultPoints;
          });
          setSettingsOpen(false);
        }}
      />

      <Modal
        open={demosOpen}
        title="Демонстрационные паки"
        onClose={() => setDemosOpen(false)}
        wide
        footer={
          <Button variant="ghost" onClick={() => setDemosOpen(false)}>
            Закрыть
          </Button>
        }
      >
        {demos.length === 0 ? (
          <div className="empty">
            <div className="empty__title">Демо-паки не найдены</div>
            <div>Они лежат в папке packs рядом с приложением</div>
          </div>
        ) : (
          <div className="demo-list">
            {demos.map((demo) => (
              <div className="demo-item" key={demo.path}>
                <div className="grow">
                  <div className="demo-item__title">{demo.title}</div>
                  <div className="small muted">{demo.description || 'Без описания'}</div>
                  <div className="small dim">
                    {demo.rounds} раундов · {demo.questions} вопросов
                  </div>
                </div>
                <Button size="sm" variant="primary" onClick={() => void openDemo(demo.path)}>
                  Открыть
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={copyOpen}
        title="Скопировать вопрос в другой раунд"
        onClose={() => setCopyOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCopyOpen(false)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={copyQuestionToRound}>
              Скопировать
            </Button>
          </>
        }
      >
        <div className="col gap-12">
          <div className="muted">Копия появится в конце выбранного раунда и не изменит оригинал.</div>
          <div className="col gap-6">
            {pack.rounds.map((round, index) => (
              <label key={round.id} className={`copy-option${index === roundIndex ? ' is-disabled' : ''}`}>
                <input
                  type="radio"
                  name="copy-round"
                  checked={copyTargetRound === index}
                  disabled={index === roundIndex}
                  onChange={() => setCopyTargetRound(index)}
                />
                <span className="grow">
                  {index + 1}. {round.title || 'Без названия'}
                </span>
                <span className="dim small">{round.questions.length} вопросов</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function timeOf(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function errorText(error: unknown): string {
  return humanizeError(error);
}

interface PackSettingsModalProps {
  open: boolean;
  pack: QuizPack;
  onClose: () => void;
  onApply: (values: {
    title: string;
    description: string;
    theme: ThemeId;
    defaultTimeLimitSec: number;
    defaultPoints: number;
    music: MediaAsset[];
  }) => void;
}

function PackSettingsModal({ open, pack, onClose, onApply }: PackSettingsModalProps) {
  const toast = useToast();
  const [title, setTitle] = useState(pack.title);
  const [description, setDescription] = useState(pack.description);
  const [time, setTime] = useState(String(pack.settings.defaultTimeLimitSec));
  const [points, setPoints] = useState(String(pack.settings.defaultPoints));
  const [theme, setTheme] = useState<ThemeId>(pack.theme);
  const [music, setMusic] = useState<MediaAsset[]>(pack.music);
  const [musicBusy, setMusicBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(pack.title);
    setDescription(pack.description);
    setTime(String(pack.settings.defaultTimeLimitSec));
    setPoints(String(pack.settings.defaultPoints));
    setTheme(pack.theme);
    setMusic(pack.music);
    setMusicBusy(false);
  }, [open, pack]);

  async function addMusicTrack(): Promise<void> {
    if (musicBusy) return;
    setMusicBusy(true);
    try {
      const asset = await window.qm.pack.addMedia('audio');
      if (asset) {
        setMusic((prev) => (prev.some((track) => track.id === asset.id) ? prev : [...prev, asset]));
      }
    } catch (error) {
      toast.error(`Не удалось добавить трек: ${errorText(error)}`);
    } finally {
      setMusicBusy(false);
    }
  }

  function removeMusicTrack(index: number): void {
    setMusic((prev) => prev.filter((_, trackIndex) => trackIndex !== index));
  }

  function moveMusicTrack(index: number, direction: -1 | 1): void {
    setMusic((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [track] = next.splice(index, 1);
      next.splice(target, 0, track);
      return next;
    });
  }

  const selectedTheme = PACK_THEMES.find((item) => item.id === theme) ?? PACK_THEMES[0];

  return (
    <Modal
      open={open}
      title="Настройки пака"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              onApply({
                title: title.trim() || 'Новый квиз',
                description: description.trim(),
                theme,
                defaultTimeLimitSec: clamp(Number(time), 5, 3600, 60),
                defaultPoints: clamp(Number(points), 0, 1000, 1),
                music
              })
            }
          >
            Применить
          </Button>
        </>
      }
    >
      <div className="col gap-16">
        <Field label="Название игры">
          <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Описание" hint="Показывается на игровом экране перед началом">
          <textarea
            className="textarea"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="row gap-16">
          <Field label="Время по умолчанию, сек" hint="Для новых вопросов" className="grow">
            <input
              className="input"
              type="number"
              min={5}
              max={3600}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </Field>
          <Field label="Баллы по умолчанию" hint="Для новых вопросов" className="grow">
            <input
              className="input"
              type="number"
              min={0}
              max={1000}
              step={0.5}
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </Field>
        </div>
        <div className="music-block">
          <div className="music-block__head">
            <div className="grow">
              <div className="music-block__title">Фоновая музыка (необязательно)</div>
              <div className="music-block__hint small dim">
                Играет в лобби, на заставках раундов, при сдаче бланков, между раундами и на итогах.
                Ведущий может менять громкость и ставить музыку на паузу.
              </div>
            </div>
            <Button size="sm" onClick={() => void addMusicTrack()} disabled={musicBusy}>
              {musicBusy ? 'Выбор…' : 'Добавить трек'}
            </Button>
          </div>
          {music.length === 0 ? (
            <div className="music-empty">Плейлист пуст — игра пройдёт без фоновой музыки</div>
          ) : (
            <div className="music-list">
              {music.map((track, index) => (
                <div className="music-item" key={track.id}>
                  <span className="music-item__icon" aria-hidden="true">
                    ♪
                  </span>
                  <div className="grow">
                    <div className="music-item__name truncate" title={track.fileName}>
                      {track.fileName}
                    </div>
                    <div className="music-item__meta small dim">
                      {formatBytes(track.size)}
                      {music.length > 1 ? ` · ${index + 1} из ${music.length}` : ''}
                    </div>
                  </div>
                  <div className="music-item__actions">
                    <button
                      type="button"
                      className="mini-btn"
                      title="Выше"
                      disabled={index === 0}
                      onClick={() => moveMusicTrack(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="mini-btn"
                      title="Ниже"
                      disabled={index === music.length - 1}
                      onClick={() => moveMusicTrack(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="mini-btn mini-btn--danger"
                      title="Удалить трек"
                      onClick={() => removeMusicTrack(index)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="theme-picker">
          <div className="theme-picker__head">
            <span className="theme-picker__title">Тема оформления</span>
            <span className="theme-picker__hint">
              Применяется только к игровому экрану во время игры. Редактор и панель ведущего не меняются.
            </span>
          </div>

          <ThemePreview theme={theme} />

          <div className="theme-picker__caption">
            <strong>{selectedTheme.label}</strong>
            <span>{selectedTheme.description}</span>
          </div>

          <div className="theme-groups">
            {THEME_GROUPS.map((group) => {
              const items = themesOfGroup(group.id);
              if (items.length === 0) return null;
              const groupTitleId = `theme-group-${group.id}`;
              return (
                <section className="theme-group" key={group.id} aria-labelledby={groupTitleId}>
                  <h4 className="theme-group__title" id={groupTitleId}>
                    {group.label}
                  </h4>
                  <div className="theme-grid">
                    {items.map((item) => {
                      const active = theme === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`theme-card${active ? ' is-active' : ''}`}
                          onClick={() => setTheme(item.id)}
                          aria-pressed={active}
                          title={item.description}
                        >
                          <span
                            className="theme-card__preview"
                            aria-hidden="true"
                            style={{
                              background: `linear-gradient(135deg, ${item.swatch[0]} 0%, ${item.swatch[1]} 55%, ${item.swatch[2]} 100%)`
                            }}
                          />
                          <span className="theme-card__label">{item.label}</span>
                          {active ? (
                            <span className="theme-card__check" aria-hidden="true">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
        <div className="small dim">
          «Частично» в панели ведущего всегда даёт половину стоимости вопроса (50%).
        </div>
      </div>
    </Modal>
  );
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export type { MediaKind };
