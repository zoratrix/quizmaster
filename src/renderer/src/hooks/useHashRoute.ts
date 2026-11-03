import { useEffect, useState } from 'react';

export type Route = 'editor' | 'host' | 'game';

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (hash === 'host') return 'host';
  if (hash === 'game') return 'game';
  return 'editor';
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = (): void => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
