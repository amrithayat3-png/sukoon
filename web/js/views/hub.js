import { api, keyStore } from '../api.js';
import { state } from '../state.js';
import { h, mount, link, errorBox, pageTitle } from '../ui.js';
import { breatheSection, worldArt } from '../worlds.js';
import { heroArt, packIcon, packTone, stepIcon, trackIcon, trackTone } from '../icons.js';

const FORMAT_LABEL = { checkin: 'Questions', scenario: 'Story choices', measure: 'Questionnaire' };

export async function hubView(root) {
  pageTitle('Welcome');
  try {
    const { tracks } = await api.tracks();
    const acct = state.saas && keyStore.get() ? await api.me().catch(() => null) : null;
    const trackSection = h('section', { id: 'tracks' });
    mount(root,
      acct ? h('div', { class: 'acct' },
        h('strong', null, acct.org.name),
        h('span', { class: 'chip' }, acct.org.plan === 'paid' ? 'Paid plan' : 'Free pilot'),
        h('span', { class: 'small muted' }, `${acct.org.sessionsThisMonth} of ${acct.org.monthlySessionLimit} sessions used this month`),
        acct.org.expiresAt ? h('span', { class: 'small muted' }, `Access until ${acct.org.expiresAt.slice(0, 10)}`) : null) : null,
      h('section', { class: 'hero' },
        h('div', null,
          h('span', { class: 'chip' }, 'Welcome'),
          h('h1', { class: 'hero-title' }, 'Sukoon'),
          h('p', { class: 'hero-tag' }, 'A calmer conversation starts here.'),
          h('p', { class: 'lead' }, 'Friendly activities that help people talk about what is on their mind, and give the psychologist a clear starting point.'),
          h('button', { class: 'btn big glow', type: 'button', onClick: () => trackSection.scrollIntoView({ behavior: 'smooth' }) }, 'Begin a session'),
          h('div', { class: 'trust' }, ['No names needed', 'Answers erased automatically', 'Phone, tablet and laptop'].map((t) => h('span', { class: 'trust-chip' }, h('i', { 'aria-hidden': 'true' }), t)))),
        h('div', { class: 'hero-frame' }, heroArt())),
      h('div', { class: 'row' }, link('#/set', 'Build a custom set', 'btn ghost'), state.saas ? link('#/usage', 'Usage', 'btn ghost') : null),
      breatheSection(),
      h('section', null,
        h('div', { class: 'steps' },
          step('everyday', 'sun', '1. Choose', 'Pick who the session is for, then an activity that fits the issue.'),
          step('relationships', 'coral', '2. Explore together', 'Short questions or story choices, one at a time. No right or wrong answers.'),
          step('stress', 'mint', '3. Talk it through', 'A simple summary shows where to start the conversation.'))),
      trackSection);
    trackSection.append(
      h('div', { class: 'section-title' }, h('div', null, h('span', { class: 'eyebrow' }, 'Choose a path'), h('h2', null, 'Who is this session for?'))),
      h('div', { class: 'grid' }, tracks.map((t) =>
        h('a', { class: `card tile tone-${trackTone(t.id)}`, href: `#/track/${t.id}`, 'aria-label': `${t.label}, ages ${t.ageRange}, ${t.packCount} activities` },
          h('div', { class: 'tile-scene' }, worldArt(t.id), trackIcon(t.id, true)),
          h('h3', null, t.label),
          h('span', { class: 'chip' }, `Ages ${t.ageRange}`),
          h('p', null, t.description),
          h('span', { class: 'go' }, t.packCount ? `${t.packCount} ${t.packCount === 1 ? 'activity' : 'activities'}  →` : 'Coming soon')))));
  } catch (err) { mount(root, errorBox(err.message)); }
}

function step(icon, tone, title, text) {
  return h('div', { class: 'step' }, stepIcon(icon, tone), h('div', null, h('h3', null, title), h('p', null, text)));
}

const GROUPS = [
  ['general', 'For everyone'],
  ['men', "Men's pack"],
  ['women', "Women's pack"],
];

export async function trackView(root, trackId) {
  pageTitle('Activities');
  try {
    const [{ tracks }, { packs }] = await Promise.all([api.tracks(), api.packs(trackId)]);
    const track = tracks.find((t) => t.id === trackId);
    const grouped = GROUPS.map(([key, label]) => [label, packs.filter((p) => (key === 'general' ? !p.audience.some((a) => a === 'men' || a === 'women') : p.audience.includes(key)))]).filter(([, list]) => list.length);
    mount(root,
      h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / ', track?.label ?? trackId),
      h('div', { class: `banner world tone-${trackTone(trackId)}` },
        worldArt(trackId),
        h('div', { class: 'banner-text' }, trackIcon(trackId, true),
          h('div', null, h('h1', { style: { margin: 0 } }, track?.label ?? 'Activities'), h('p', { class: 'muted', style: { margin: 0 } }, track?.description ?? '')))),
      packs.length
        ? grouped.map(([label, list]) => h('section', null,
            grouped.length > 1 ? h('div', { class: 'section-title' }, h('h2', null, label)) : null,
            h('div', { class: 'grid' }, list.map(packTile))))
        : h('div', { class: 'card' }, h('p', null, 'Activities for this group are being developed with clinicians. Please check back soon.')));
  } catch (err) { mount(root, errorBox(err.message)); }
}

function packTile(p) {
  return h('a', { class: `card tile tone-${packTone(p.id)}`, href: `#/pack/${p.id}` },
    packIcon(p.id),
    h('h3', null, p.title),
    h('div', { class: 'row' }, h('span', { class: 'chip' }, FORMAT_LABEL[p.format] ?? 'Activity'), h('span', { class: 'chip' }, `About ${p.estimatedMinutes} min`)),
    h('p', null, p.summary),
    h('span', { class: 'go' }, 'Open  →'));
}
