export function resolvePageKey(getPageKey?: () => string): string {
  if (getPageKey) {
    return getPageKey();
  }
  return window.location.pathname;
}

export function subscribeToPageKey(onChange: () => void): () => void {
  const notify = () => onChange();

  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
    originalPushState(data, unused, url);
    notify();
  }) as typeof history.pushState;

  history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
    originalReplaceState(data, unused, url);
    notify();
  }) as typeof history.replaceState;

  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };
}
