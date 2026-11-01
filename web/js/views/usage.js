import { api } from '../api.js';
import { errorBox, h, link, mount, pageTitle } from '../ui.js';

/** How much the institute has used Sukoon in the last 30 days. Numbers only. */
export async function usageView(root) {
  pageTitle('Usage');
  try {
    const [usage, tracks] = await Promise.all([api.usage(), api.tracks()]);
    const lists = await Promise.all(tracks.tracks.map((t) => api.packs(t.id)));
    const titles = new Map(lists.flatMap((l) => l.packs.map((p) => [p.id, p.title])));
    const peak = Math.max(1, ...usage.days.map((d) => d.created));
    const rate = usage.totals.created ? Math.round((usage.totals.completed / usage.totals.created) * 100) : 0;
    mount(root,
      h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / Usage'),
      h('h1', null, 'Usage, last 30 days'),
      h('div', { class: 'grid stats' },
        stat(usage.totals.created, 'sessions started'),
        stat(usage.totals.completed, 'sessions finished'),
        stat(`${rate}%`, 'finished')),
      h('section', { class: 'card' },
        h('h2', null, 'Sessions per day'),
        h('div', { class: 'bars', role: 'img', 'aria-label': `Sessions started per day, highest ${peak}` }, usage.days.map((d) =>
          h('div', { class: 'barcol', title: `${d.date}: ${d.created} started, ${d.completed} finished` }, h('span', { style: { height: `${Math.round((d.created / peak) * 100)}%` } })))),
        h('div', { class: 'row between small muted' }, h('span', null, usage.days[0]?.date), h('span', null, usage.days.at(-1)?.date))),
      h('section', { class: 'card' },
        h('h2', null, 'Most used activities this month'),
        usage.packs.length
          ? h('ol', null, usage.packs.map((p) => h('li', null, `${titles.get(p.packId) ?? p.packId}: ${p.created}`)))
          : h('p', { class: 'muted' }, 'Nothing yet.')),
      h('p', { class: 'small muted' }, 'Only counts are kept here. No answers, names or labels are stored in usage numbers.'));
  } catch (err) { mount(root, errorBox(err.message)); }
}

const stat = (value, label) => h('div', { class: 'card stat' }, h('div', { class: 'stat-n' }, String(value)), h('div', { class: 'muted' }, label));
