import { api } from '../api.js';
import { h, mount, link, errorBox, pageTitle } from '../ui.js';

export async function hubView(root) {
  pageTitle('Choose a track');
  try {
    const { tracks } = await api.tracks();
    mount(root,
      h('div', { class: 'hero' },
        h('h1', null, 'Who is this session for?'),
        h('p', null, 'Choose a track to see its activities. Content is in draft until reviewed by a licensed psychologist.')),
      h('div', { class: 'grid' }, tracks.map((t) =>
        h('a', { class: 'card tile', href: `#/track/${t.id}`, 'aria-label': `${t.label}, ages ${t.ageRange}, ${t.packCount} activities` },
          h('span', { class: 'chip' }, `Ages ${t.ageRange}`),
          h('h3', null, t.label),
          h('p', { class: 'muted small' }, t.description),
          h('span', { class: 'small' }, t.packCount ? `${t.packCount} ${t.packCount === 1 ? 'activity' : 'activities'}` : 'Coming soon')))));
  } catch (err) { mount(root, errorBox(err.message)); }
}

export async function trackView(root, trackId) {
  pageTitle('Activities');
  try {
    const [{ tracks }, { packs }] = await Promise.all([api.tracks(), api.packs(trackId)]);
    const track = tracks.find((t) => t.id === trackId);
    mount(root,
      h('div', { class: 'crumbs' }, link('#/', 'All tracks'), ' / ', track?.label ?? trackId),
      h('h1', null, track?.label ?? 'Activities'),
      h('p', { class: 'muted' }, track?.description ?? ''),
      packs.length
        ? h('div', { class: 'grid' }, packs.map((p) =>
            h('a', { class: 'card tile', href: `#/pack/${p.id}` },
              h('div', { class: 'row' },
                h('span', { class: 'chip' }, p.format === 'checkin' ? 'Check-in' : 'Scenarios'),
                p.status === 'draft' ? h('span', { class: 'chip draft' }, 'Draft') : null),
              h('h3', null, p.title),
              h('p', { class: 'muted small' }, p.summary),
              h('span', { class: 'small' }, `About ${p.estimatedMinutes} min, ${p.itemCount} ${p.format === 'checkin' ? 'questions' : 'scenarios'}`))))
        : h('div', { class: 'card' }, h('p', null, 'No activities in this track yet. They are being developed with clinicians.')));
  } catch (err) { mount(root, errorBox(err.message)); }
}
