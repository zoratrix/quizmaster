import type { QuizApi } from '../../shared/api';

declare global {
  interface Window {
    qm: QuizApi;
  }
}

export {};
