/** In-memory state for the current visit. Nothing about a patient is written to browser storage. */
export const state = {
  open: false,        // true when the server runs without access keys
  locks: new Map(),   // sessionId -> PIN chosen by the clinician (a courtesy lock, not security)
  unlocked: new Set(),
  packs: new Map(),   // packId -> pack detail
};

export function prefs() {
  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
  return {
    large: read('sukoon.large') === '1',
    theme: read('sukoon.theme') || 'auto',
    setLarge(v) { write('sukoon.large', v ? '1' : '0'); apply(); },
    setTheme(v) { write('sukoon.theme', v); apply(); },
  };
}

export function apply() {
  const p = prefs();
  const root = document.documentElement;
  if (p.large) root.setAttribute('data-large', '1'); else root.removeAttribute('data-large');
  document.documentElement.dataset.themeResolved = isDark() ? 'dark' : 'light';
  if (p.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', p.theme);
}

export function isDark() {
  const t = prefs().theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
