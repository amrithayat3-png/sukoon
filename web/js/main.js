import { api, keyStore } from './api.js';
import { apply, isDark, prefs, state } from './state.js';
import { h } from './ui.js';
import { logo } from './icons.js';
import { loginView } from './views/login.js';
import { hubView, trackView } from './views/hub.js';
import { packView } from './views/pack.js';
import { runView } from './views/run.js';
import { handoffView } from './views/handoff.js';
import { resultsView } from './views/results.js';
import { referencesView } from './views/references.js';
import { aboutView } from './views/about.js';

const root = document.getElementById('main');
const nav = document.getElementById('topnav');

document.getElementById('brand').append(logo(38), h('span', { class: 'wordmark' }, 'Sukoon'));
document.getElementById('foot').append(
  'Sukoon, a calmer conversation. ', h('a', { href: '#/about' }, 'About this tool'));

function renderNav() {
  const p = prefs();
  const keyed = !state.open && Boolean(keyStore.get());
  nav.replaceChildren(...[
    h('button', { class: 'btn ghost small', type: 'button', 'aria-pressed': String(p.large), onClick: () => { p.setLarge(!p.large); renderNav(); } },
      p.large ? 'Smaller text' : 'Larger text'),
    h('button', { class: 'btn ghost small', type: 'button', onClick: () => { p.setTheme(isDark() ? 'light' : 'dark'); renderNav(); } },
      isDark() ? 'Light mode' : 'Dark mode'),
    h('a', { class: 'btn ghost small', href: '#/references' }, 'References'),
    keyed ? h('button', { class: 'btn ghost small', type: 'button', onClick: () => { keyStore.clear(); location.hash = '#/login'; } }, 'Sign out') : null,
  ].filter(Boolean));
}

const routes = [
  [/^\/login$/, loginView, false],
  [/^\/$/, hubView],
  [/^\/track\/([a-z0-9-]+)$/, trackView],
  [/^\/pack\/([a-z0-9-]+)$/, packView],
  [/^\/run\/([0-9a-f-]{36})$/, runView],
  [/^\/done\/([0-9a-f-]{36})$/, handoffView],
  [/^\/results\/([0-9a-f-]{36})$/, resultsView],
  [/^\/references$/, referencesView],
  [/^\/about$/, aboutView, false],
];

function route() {
  const path = location.hash.replace(/^#/, '') || '/';
  renderNav();
  root.className = '';
  document.body.classList.toggle('patient-mode', path.startsWith('/run/') || path.startsWith('/done/'));
  for (const [pattern, view, needsKey = true] of routes) {
    const match = pattern.exec(path);
    if (!match) continue;
    if (needsKey && !state.open && !keyStore.get()) { location.hash = '#/login'; return; }
    if (path === '/login' && state.open) { location.hash = '#/'; return; }
    view(root, ...match.slice(1));
    return;
  }
  location.hash = '#/';
}

apply();
window.addEventListener('hashchange', route);
(async () => {
  try { state.open = Boolean((await api.meta()).openAccess); } catch { state.open = false; }
  route();
})();
