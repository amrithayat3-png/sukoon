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
import { adminView } from './views/admin.js';
import { setView } from './views/set.js';
import { helpView } from './views/help.js';
import { toolsView } from './views/tools.js';
import { usageView } from './views/usage.js';
import { accountView } from './views/account.js';
import { privacyView, termsView } from './legal.js';
import { openFeedback } from './extras.js';

const root = document.getElementById('main');
document.body.prepend(h('div', { class: 'aurora', 'aria-hidden': 'true' }, h('i', { class: 'a1' }), h('i', { class: 'a2' }), h('i', { class: 'a3' })));

// Gentle reveal on scroll. Elements are marked by script, so without JS everything stays visible.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const seen = 'IntersectionObserver' in window && !calm
  ? new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } }, { threshold: 0.12 })
  : null;
function reveal() {
  root.querySelectorAll('.card, .step, .section-title, .reveal, .banner').forEach((el, i) => {
    if (!seen) return;
    el.classList.add('reveal');
    el.classList.add(`rd${i % 4}`);
    seen.observe(el);
  });
}
const nav = document.getElementById('topnav');
const fab = h('button', { class: 'fab noprint', type: 'button', onClick: () => openFeedback(location.hash.replace(/^#/, '') || '/') }, 'Feedback');
document.body.append(fab);

document.getElementById('brand').append(logo(38), h('span', { class: 'wordmark' }, 'Sukoon'));
document.getElementById('foot').append(
  'Sukoon, a calmer conversation. ', h('a', { href: '#/about' }, 'About this tool'), ' | ', h('a', { href: '#/privacy' }, 'Privacy'), ' | ', h('a', { href: '#/terms' }, 'Terms'), ' | ', h('a', { href: '#/help' }, 'Help now'), ' | ', h('a', { href: '#/admin' }, 'Institute admin'));

function renderNav() {
  const p = prefs();
  const keyed = !state.open && Boolean(keyStore.get());
  nav.replaceChildren(...[
    h('button', { class: 'btn ghost small', type: 'button', 'aria-pressed': String(p.large), onClick: () => { p.setLarge(!p.large); renderNav(); } },
      p.large ? 'Smaller text' : 'Larger text'),
    h('button', { class: 'btn ghost small', type: 'button', onClick: () => { p.setTheme(isDark() ? 'light' : 'dark'); renderNav(); } },
      isDark() ? 'Light mode' : 'Dark mode'),
    h('button', { class: 'btn ghost small', type: 'button', 'aria-pressed': String(p.simple), onClick: () => { p.setSimple(!p.simple); renderNav(); } }, p.simple ? 'Normal view' : 'Simple mode'),
    h('a', { class: 'btn ghost small', href: '#/help' }, 'Help now'),
    h('a', { class: 'btn ghost small', href: '#/tools' }, 'Tools'),
    h('a', { class: 'btn ghost small', href: '#/references' }, 'References'),
    keyed && state.saas ? h('a', { class: 'btn ghost small', href: '#/account' }, 'Account') : null,
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
  [/^\/set$/, setView],
  [/^\/usage$/, usageView],
  [/^\/tools$/, toolsView, false],
  [/^\/help$/, helpView, false],
  [/^\/privacy$/, privacyView, false],
  [/^\/terms$/, termsView, false],
  [/^\/account$/, accountView],
  [/^\/about$/, aboutView, false],
  [/^\/admin$/, adminView, false],
];

function route() {
  const path = location.hash.replace(/^#/, '') || '/';
  renderNav();
  root.className = '';
  window.speechSynthesis?.cancel();
  const pm = path.startsWith('/run/') || path.startsWith('/done/') || path === '/login';
  fab.hidden = pm || (!state.open && !keyStore.get());
  document.body.classList.toggle('patient-mode', path.startsWith('/run/') || path.startsWith('/done/'));
  for (const [pattern, view, needsKey = true] of routes) {
    const match = pattern.exec(path);
    if (!match) continue;
    if (needsKey && !state.open && !keyStore.get()) { location.hash = '#/login'; return; }
    if (path === '/login' && state.open) { location.hash = '#/'; return; }
    Promise.resolve(view(root, ...match.slice(1))).then(reveal);
    return;
  }
  location.hash = '#/';
}

apply();
window.addEventListener('hashchange', route);
(async () => {
  try { const meta = await api.meta(); state.open = Boolean(meta.openAccess); state.saas = Boolean(meta.saas); } catch { state.open = false; }
  route();
})();
