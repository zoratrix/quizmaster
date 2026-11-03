import { EventEmitter } from 'node:events';
import type { GameMode, GameState, QuizPack, Team } from '../shared/types';
import { HAND_IN_SEC, REVIEW_PER_QUESTION_SEC } from '../shared/types';
import type { TickPayload } from '../shared/api';
import { createTeam, newId, normalizePack } from '../shared/factory';
import { clampScore, roundScore } from '../shared/scoring';
import { clearSession, writeSession } from './session';

const TICK_MS = 100;
const RUNNING_PERSIST_INTERVAL_MS = 3000;

export interface ControllerEvents {
  state: (state: GameState) => void;
  tick: (payload: TickPayload) => void;
  notice: (notice: { kind: 'error' | 'info' | 'success'; message: string }) => void;
}

function questionDurationMs(pack: QuizPack, roundIndex: number, questionIndex: number): number {
  const question = pack.rounds[roundIndex]?.questions[questionIndex];
  return Math.max(1, question?.timeLimitSec ?? 60) * 1000;
}

export class GameController extends EventEmitter {
  private current: GameState | null = null;
  private ticker: NodeJS.Timeout | null = null;
  private lastPersistAt = 0;
  private persistScheduled = false;

  get state(): GameState | null {
    return this.current;
  }

  // ---------- Подготовка ----------

  prepare(pack: QuizPack, packPath: string | null): GameState {
    const normalized = normalizePack(pack);
    const duration = questionDurationMs(normalized, 0, 0);
    this.current = {
      sessionId: newId('game'),
      phase: 'lobby',
      mode: 'team',
      pack: normalized,
      packPath,
      teams: [],
      roundIndex: 0,
      questionIndex: -1,
      timer: { durationMs: duration, remainingMs: duration, running: false, endsAt: null },
      paused: false,
      revealed: false,
      skippedQuestionIds: [],
      scores: {},
      startedAt: null,
      finishedAt: null,
      updatedAt: Date.now()
    };
    this.emitState();
    return this.current;
  }

  /** Восстановление прерванной игры: таймер замирает с сохранённым остатком. */
  restore(state: GameState): GameState {
    const normalized = normalizePack(state.pack);
    this.current = {
      ...state,
      pack: normalized,
      timer: {
        ...state.timer,
        running: false,
        endsAt: null,
        remainingMs: Math.max(0, Math.min(state.timer.remainingMs, state.timer.durationMs))
      },
      paused: true,
      updatedAt: Date.now()
    };
    this.emitState();
    return this.current;
  }

  clear(): void {
    this.stopTicker();
    this.current = null;
  }

  // ---------- Команды ведущего ----------

  start(payload: { teams: Team[]; mode: GameMode }): void {
    const state = this.requireState();
    const teams = payload.teams
      .map((team) => ({ id: team.id || newId('team'), name: String(team.name ?? '').trim() }))
      .filter((team) => team.name.length > 0);
    if (teams.length === 0) throw new Error('Добавьте хотя бы одну команду');
    state.teams = teams;
    state.mode = payload.mode === 'individual' ? 'individual' : 'team';
    state.scores = {};
    state.skippedQuestionIds = [];
    state.startedAt = Date.now();
    state.finishedAt = null;
    state.revealed = false;
    state.paused = false;
    this.goToRound(0);
  }

  addTeam(name: string): void {
    const state = this.requireState();
    const clean = String(name ?? '').trim();
    if (!clean) return;
    if (state.teams.length >= 40) throw new Error('Слишком много команд (максимум 40)');
    state.teams.push(createTeam(clean));
    this.emitState();
  }

  renameTeam(teamId: string, name: string): void {
    const state = this.requireState();
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return;
    const clean = String(name ?? '').trim();
    if (!clean) return;
    team.name = clean;
    this.emitState();
  }

  removeTeam(teamId: string): void {
    const state = this.requireState();
    state.teams = state.teams.filter((team) => team.id !== teamId);
    delete state.scores[teamId];
    this.emitState();
  }

  next(): void {
    const state = this.requireState();
    if (state.phase === 'lobby' || state.phase === 'finished') return;
    if (state.phase === 'round-intro') {
      this.openQuestion(0);
      return;
    }
    if (state.phase === 'question') {
      const round = state.pack.rounds[state.roundIndex];
      if (!round) return;
      if (state.questionIndex + 1 < round.questions.length) {
        this.openQuestion(state.questionIndex + 1);
      } else {
        // все вопросы раунда показаны — повторный просмотр перед сдачей бланков
        this.startRoundReview();
      }
      return;
    }
    if (state.phase === 'round-review') {
      this.advanceReview();
      return;
    }
    if (state.phase === 'round-handin') {
      this.showRoundAnswers();
      return;
    }
    if (state.phase === 'round-answers') {
      this.endRound();
      return;
    }
    if (state.phase === 'round-summary') {
      this.nextRound();
    }
  }

  prev(): void {
    const state = this.requireState();
    if (state.phase === 'question') {
      if (state.questionIndex <= 0) {
        state.phase = 'round-intro';
        state.questionIndex = -1;
        this.resetTimerToFirstQuestion();
        this.emitState();
        return;
      }
      this.openQuestion(state.questionIndex - 1);
      return;
    }
    if (state.phase === 'round-review') {
      if (state.questionIndex > 0) {
        this.openReviewQuestion(state.questionIndex - 1);
      } else {
        const duration = questionDurationMs(
          state.pack,
          state.roundIndex,
          Math.max(0, (state.pack.rounds[state.roundIndex]?.questions.length ?? 1) - 1)
        );
        state.phase = 'round-intro';
        state.questionIndex = -1;
        this.stopTimerKeepingRemaining(duration);
        state.timer = { durationMs: duration, remainingMs: duration, running: false, endsAt: null };
        this.emitState();
      }
      return;
    }
    if (state.phase === 'round-handin') {
      const lastIndex = Math.max(0, (state.pack.rounds[state.roundIndex]?.questions.length ?? 1) - 1);
      this.openReviewQuestion(lastIndex);
    }
  }

  skip(): void {
    const state = this.requireState();
    if (state.phase !== 'question') return;
    const question = state.pack.rounds[state.roundIndex]?.questions[state.questionIndex];
    if (question && !state.skippedQuestionIds.includes(question.id)) {
      state.skippedQuestionIds.push(question.id);
    }
    this.next();
  }

  pause(): void {
    const state = this.requireState();
    if (state.paused || state.phase === 'lobby' || state.phase === 'finished') return;
    this.freezeTimer();
    state.paused = true;
    this.emitState();
  }

  resume(): void {
    const state = this.requireState();
    if (!state.paused) return;
    state.paused = false;
    if (this.phaseHasTimer(state.phase) && state.timer.remainingMs > 0) {
      this.startTimer(state.timer.remainingMs);
    }
    this.emitState();
    this.emitTick();
  }

  togglePause(): void {
    const state = this.requireState();
    if (state.paused) this.resume();
    else this.pause();
  }

  toggleTimer(): void {
    const state = this.requireState();
    if (!this.phaseHasTimer(state.phase)) return;
    if (state.timer.running) {
      this.freezeTimer();
    } else {
      const remaining = state.timer.remainingMs > 0 ? state.timer.remainingMs : state.timer.durationMs;
      this.startTimer(remaining);
    }
    this.emitState();
    this.emitTick();
  }

  resetTimer(): void {
    const state = this.requireState();
    if (!this.phaseHasTimer(state.phase)) return;
    const duration = this.timerDurationForPhase(state);
    this.stopTimerKeepingRemaining(duration);
    state.timer.durationMs = duration;
    state.timer.remainingMs = duration;
    this.emitState();
    this.emitTick();
  }

  setRevealed(value: boolean): void {
    const state = this.requireState();
    state.revealed = Boolean(value);
    if (state.revealed && state.timer.running) this.freezeTimer();
    this.emitState();
    this.emitTick();
  }

  endRound(): void {
    const state = this.requireState();
    const allowed: GameState['phase'][] = [
      'round-intro',
      'question',
      'round-review',
      'round-handin',
      'round-answers'
    ];
    if (!allowed.includes(state.phase)) return;
    this.freezeTimer();
    state.phase = 'round-summary';
    state.revealed = false;
    state.paused = false;
    this.emitState();
    this.emitTick();
  }

  nextRound(): void {
    const state = this.requireState();
    if (state.roundIndex + 1 >= state.pack.rounds.length) {
      this.finish();
      return;
    }
    this.goToRound(state.roundIndex + 1);
  }

  finish(): void {
    const state = this.requireState();
    this.freezeTimer();
    state.phase = 'finished';
    state.paused = false;
    state.revealed = false;
    state.finishedAt = Date.now();
    this.emitState();
    this.emitTick();
    void clearSession();
  }

  abandon(): void {
    this.clear();
    this.emit('state', null as unknown as GameState);
    void clearSession();
  }

  setScore(teamId: string, questionId: string, points: number): void {
    const state = this.requireState();
    if (!state.teams.some((team) => team.id === teamId)) return;
    const value = clampScore(points);
    state.scores[teamId] = state.scores[teamId] ?? {};
    state.scores[teamId][questionId] = value;
    this.emitState();
  }

  addScore(teamId: string, questionId: string, delta: number): void {
    const state = this.requireState();
    const current = state.scores?.[teamId]?.[questionId] ?? 0;
    this.setScore(teamId, questionId, roundScore(current + delta));
  }

  // ---------- Внутренняя механика ----------

  private requireState(): GameState {
    if (!this.current) throw new Error('Игра не запущена');
    return this.current;
  }

  private goToRound(roundIndex: number): void {
    const state = this.requireState();
    const round = state.pack.rounds[roundIndex];
    if (!round) return;
    state.roundIndex = roundIndex;
    state.phase = 'round-intro';
    state.questionIndex = -1;
    state.paused = false;
    state.revealed = false;
    const duration = questionDurationMs(state.pack, roundIndex, 0);
    this.stopTimerKeepingRemaining(duration);
    state.timer = { durationMs: duration, remainingMs: duration, running: false, endsAt: null };
    this.emitState();
    this.emitTick();
  }

  private openQuestion(questionIndex: number): void {
    const state = this.requireState();
    const round = state.pack.rounds[state.roundIndex];
    if (!round || !round.questions[questionIndex]) return;
    state.questionIndex = questionIndex;
    state.phase = 'question';
    state.revealed = false;
    const duration = questionDurationMs(state.pack, state.roundIndex, questionIndex);
    state.timer = { durationMs: duration, remainingMs: duration, running: false, endsAt: null };
    if (!state.paused) this.startTimer(duration);
    this.emitState();
    this.emitTick();
  }

  private resetTimerToFirstQuestion(): void {
    const state = this.requireState();
    const duration = questionDurationMs(state.pack, state.roundIndex, 0);
    state.timer = { durationMs: duration, remainingMs: duration, running: false, endsAt: null };
    this.stopTicker();
  }

  // ---------- Повторный просмотр, сдача бланков, ответы ----------

  private phaseHasTimer(phase: GameState['phase']): boolean {
    return phase === 'question' || phase === 'round-review' || phase === 'round-handin';
  }

  private timerDurationForPhase(state: GameState): number {
    if (state.phase === 'round-review') return REVIEW_PER_QUESTION_SEC * 1000;
    if (state.phase === 'round-handin') return HAND_IN_SEC * 1000;
    return questionDurationMs(state.pack, state.roundIndex, Math.max(0, state.questionIndex));
  }

  private startRoundReview(): void {
    const state = this.requireState();
    state.paused = false;
    this.openReviewQuestion(0);
  }

  /** Повторный показ вопроса из этого же раунда (вопросы идут по кругу, без новых ответов). */
  private openReviewQuestion(index: number): void {
    const state = this.requireState();
    const round = state.pack.rounds[state.roundIndex];
    if (!round || !round.questions[index]) return;
    state.phase = 'round-review';
    state.questionIndex = index;
    state.revealed = false;
    const duration = REVIEW_PER_QUESTION_SEC * 1000;
    state.timer = { durationMs: duration, remainingMs: duration, running: false, endsAt: null };
    if (!state.paused) this.startTimer(duration);
    this.emitState();
    this.emitTick();
  }

  private advanceReview(): void {
    const state = this.requireState();
    const round = state.pack.rounds[state.roundIndex];
    const nextIndex = state.questionIndex + 1;
    if (round && nextIndex < round.questions.length) {
      this.openReviewQuestion(nextIndex);
    } else {
      this.startHandIn();
    }
  }

  /** 40 секунд на сдачу бланков с ответами. */
  private startHandIn(): void {
    const state = this.requireState();
    state.phase = 'round-handin';
    state.questionIndex = -1;
    state.revealed = false;
    const duration = HAND_IN_SEC * 1000;
    state.timer = { durationMs: duration, remainingMs: duration, running: false, endsAt: null };
    if (!state.paused) this.startTimer(duration);
    this.emitState();
    this.emitTick();
  }

  /** Показ правильных ответов на все вопросы раунда. */
  private showRoundAnswers(): void {
    const state = this.requireState();
    this.freezeTimer();
    state.phase = 'round-answers';
    state.questionIndex = -1;
    state.paused = false;
    state.timer = { durationMs: 0, remainingMs: 0, running: false, endsAt: null };
    this.emitState();
    this.emitTick();
  }

  private advancePhaseAfterTimer(state: GameState): boolean {
    if (state.paused) return false;
    if (state.phase === 'round-review') {
      this.advanceReview();
      return true;
    }
    if (state.phase === 'round-handin') {
      this.showRoundAnswers();
      return true;
    }
    return false;
  }

  private startTimer(remainingMs: number): void {
    const state = this.requireState();
    const remaining = Math.max(0, remainingMs);
    state.timer.remainingMs = remaining;
    state.timer.running = true;
    state.timer.endsAt = Date.now() + remaining;
    this.ensureTicker();
  }

  private stopTimerKeepingRemaining(remainingMs: number): void {
    const state = this.requireState();
    state.timer.running = false;
    state.timer.endsAt = null;
    state.timer.remainingMs = Math.max(0, remainingMs);
  }

  private freezeTimer(): void {
    const state = this.requireState();
    const remaining = this.computeRemaining();
    state.timer.running = false;
    state.timer.endsAt = null;
    state.timer.remainingMs = remaining;
    this.stopTicker();
  }

  private computeRemaining(): number {
    const state = this.current;
    if (!state) return 0;
    if (!state.timer.running || state.timer.endsAt === null) return state.timer.remainingMs;
    return Math.max(0, state.timer.endsAt - Date.now());
  }

  private ensureTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.onTick(), TICK_MS);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private onTick(): void {
    const state = this.current;
    if (!state) {
      this.stopTicker();
      return;
    }
    if (!state.timer.running || state.timer.endsAt === null) {
      this.stopTicker();
      return;
    }
    const remaining = Math.max(0, state.timer.endsAt - Date.now());
    state.timer.remainingMs = remaining;
    if (remaining <= 0) {
      state.timer.running = false;
      state.timer.endsAt = null;
      state.timer.remainingMs = 0;
      this.stopTicker();
      this.emit('tick', this.tickPayload(true));
      // Повторный просмотр и сдача бланков переключаются сами, вопросы — ждут ведущего
      if (this.advancePhaseAfterTimer(state)) return;
      this.emitState();
      return;
    }
    this.emit('tick', this.tickPayload(false));
    const now = Date.now();
    if (now - this.lastPersistAt >= RUNNING_PERSIST_INTERVAL_MS) {
      this.lastPersistAt = now;
      void this.persist();
    }
  }

  private tickPayload(ended: boolean): TickPayload {
    const state = this.current;
    return {
      remainingMs: state ? this.computeRemaining() : 0,
      running: Boolean(state?.timer.running),
      paused: Boolean(state?.paused),
      ended
    };
  }

  emitTick(): void {
    this.emit('tick', this.tickPayload(false));
  }

  private emitState(): void {
    const state = this.current;
    if (!state) return;
    state.updatedAt = Date.now();
    this.emit('state', state);
    void this.persist();
  }

  private async persist(): Promise<void> {
    const state = this.current;
    if (!state) return;
    if (state.phase === 'finished' || state.phase === 'lobby') {
      // незавершённую игру храним отдельно; лобби не восстанавливаем
      return;
    }
    this.lastPersistAt = Date.now();
    if (this.persistScheduled) return;
    this.persistScheduled = true;
    try {
      await writeSession(state);
    } finally {
      this.persistScheduled = false;
    }
  }
}
