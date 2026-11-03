import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ToastProvider } from './components/Toasts';
import { Button } from './components/Button';
import { useHashRoute } from './hooks/useHashRoute';
import { EditorApp } from './editor/EditorApp';
import { HostApp } from './host/HostApp';
import { GameApp } from './game/GameApp';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] ошибка интерфейса:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="empty" style={{ height: '100vh' }}>
          <div className="empty__title">Что-то пошло не так</div>
          <div className="muted" style={{ maxWidth: 560 }}>
            {this.state.error.message}
          </div>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Перезапустить окно
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const route = useHashRoute();

  return (
    <ErrorBoundary>
      <ToastProvider>
        {route === 'host' ? <HostApp /> : route === 'game' ? <GameApp /> : <EditorApp />}
      </ToastProvider>
    </ErrorBoundary>
  );
}
