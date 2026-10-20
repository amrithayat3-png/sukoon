import { keyStore } from './api.js';
import { apply, prefs } from './state.js';
import { h } from './ui.js';
import { loginView } from './views/login.js';
import { hubView, trackView } from './views/hub.js';
import { packView } from './views/pack.js';
import { runView } from './views/run.js';
import { handoffView } from './views/handoff.js';
import { resultsView } from './views/results.js';
import { referencesView } from './views/references.js';

const root = document.getElementById('main');
const nav = document.getElementById('topnav');

function renderNav() {
  const p = prefs();
  const signedIn = Boolean(keyStore.get());
  nav.replaceChildren(
    h('button', { class: 'btn ghost small', 'aria-pressed': String(p.large), onClick: () => { p.setLarge(!p.large); renderNav(); } }, 'Larger text'),
    h('button', { class: 'btn ghost small', onClick: () => { p.setTheme(p.theme === 'dark' ? 'light' : 'dark'); renderNav(); } }, 'Light / dark'),
    signedIn ? h('a', { class: 'btn ghost small', href: '#/references' }, 'References') : null,
    signedIn ? h('button', { class: 'btn ghost small', onClick: () => { keyStore.clear(); location.hash = '#/login'; } }, 'Sign out') : null);
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
];

function route() {
  const path = location.hash.replace(/^#/, '') || '/';
  renderNav();
  document.body.classList.toggle('patient-mode', path.startsWith('/run/') || path.startsWith('/done/'));
  for (const [pattern, view, needsKey = true] of routes) {
    const match = pattern.exec(path);
    if (!match) continue;
    if (needsKey && !keyStore.get()) { location.hash = '#/login'; return; }
    view(root, ...match.slice(1));
    return;
  }
  location.hash = '#/';
}

apply();
window.addEventListener('hashchange', route);
route();
