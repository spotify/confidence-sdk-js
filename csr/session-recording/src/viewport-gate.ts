/**
 * Calls `onReady` once the page is visible to a person: not prerendering, and with a non-zero
 * viewport. Headless browsers, prerenders and zero-size iframes otherwise produce recordings
 * of a 0px-wide page that nobody saw. If the page never qualifies, `onReady` is never called.
 *
 * Outside a browser it calls `onReady` straight away. Returns a function that cancels the wait.
 */
export function whenViewportReady(onReady: () => void, debugLogger?: (msg: string) => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    onReady();
    return () => {};
  }
  if (isReady()) {
    onReady();
    return () => {};
  }

  debugLogger?.('Recording deferred until the page is visible with a non-zero viewport');
  const check = () => {
    if (!isReady()) return;
    cancel();
    onReady();
  };
  const cancel = () => {
    window.removeEventListener('resize', check);
    document.removeEventListener('visibilitychange', check);
    document.removeEventListener('prerenderingchange', check);
  };
  window.addEventListener('resize', check);
  document.addEventListener('visibilitychange', check);
  document.addEventListener('prerenderingchange', check);
  return cancel;
}

function isReady(): boolean {
  if ((document as Document & { prerendering?: boolean }).prerendering) return false;
  return viewportWidth() > 0 && viewportHeight() > 0;
}

// Same fallback chain the recorder uses for the Meta event, so a page that passes here
// never records a 0-sized viewport.
function viewportWidth(): number {
  return window.innerWidth || document.documentElement?.clientWidth || document.body?.clientWidth || 0;
}

function viewportHeight(): number {
  return window.innerHeight || document.documentElement?.clientHeight || document.body?.clientHeight || 0;
}
