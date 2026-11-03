import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Notice } from '../../../shared/api';

interface ToastItem extends Notice {
  id: number;
}

interface ToastApi {
  push: (kind: Notice['kind'], message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (kind: Notice['kind'], message: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
      window.setTimeout(() => remove(id), kind === 'error' ? 9000 : 4500);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      error: (message: string) => push('error', message),
      success: (message: string) => push('success', message),
      info: (message: string) => push('info', message)
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.kind}`}>
            <span className="toast__dot" />
            <span className="toast__text">{item.message}</span>
            <button className="toast__close" onClick={() => remove(item.id)} aria-label="Скрыть">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast должен использоваться внутри ToastProvider');
  return context;
}
