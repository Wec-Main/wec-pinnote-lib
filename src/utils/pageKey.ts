export function resolvePageKey(getPageKey?: () => string): string {
  if (getPageKey) {
    return getPageKey();
  }
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.pathname;
}

export function subscribeToPageKey(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const notify = () => onChange();

  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  const patchedPushState = ((data: unknown, unused: string, url?: string | URL | null) => {
    originalPushState(data, unused, url);
    notify();
  }) as typeof history.pushState;

  const patchedReplaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
    originalReplaceState(data, unused, url);
    notify();
  }) as typeof history.replaceState;

  history.pushState = patchedPushState;
  history.replaceState = patchedReplaceState;

  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
    if (history.pushState === patchedPushState) {
      history.pushState = originalPushState;
    }
    if (history.replaceState === patchedReplaceState) {
      history.replaceState = originalReplaceState;
    }
  };
}
