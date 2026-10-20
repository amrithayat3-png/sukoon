import { api } from '../api.js';
import { BAND_LABEL, h, mount, link, errorBox, pageTitle } from '../ui.js';
import { packIcon } from '../icons.js';

export async function resultsView(root, sessionId) {
  pageTitle('Session summary');
  try {
    const { session, results } = await api.results(sessionId);
    const download = () => {
      const blob = new Blob([JSON.stringify({ session, results }, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `sukoon-${session.code}.json` });
      document.body.append(a); a.click(); a.remove();
    };
    const erase = async (btn) => {
      if (!confirm('Erase this session and its answers now? This cannot be undone.')) return;
      btn.disabled = true;
      try { await api.erase(sessionId); location.hash = '#/'; } catch (e) { mount(root, errorBox(e.message)); }
    };
    const eraseBtn = h('button', { class: 'btn danger', onClick: () => erase(eraseBtn) }, 'Erase session now');
    mount(root,
      h('div', { class: 'crumbs noprint' }, link('#/', 'Home'), ' / Session summary'),
      h('div', { class: 'row between' },
        h('div', { class: 'row' },
          packIcon(results.packId),
          h('div', null, h('h1', { style: { margin: 0 } }, 'Session summary'),
            h('p', { class: 'muted small', style: { margin: 0 } }, `Code ${session.code}`, session.alias ? ` · ${session.alias}` : '', ` · ${new Date(session.completedAt).toLocaleString()}`))),
        h('div', { class: 'row noprint' },
          h('button', { class: 'btn ghost small', onClick: () => window.print() }, 'Print'),
          h('button', { class: 'btn ghost small', onClick: download }, 'Download JSON'))),
      results.flags.length ? h('div', { class: 'stack', style: { marginTop: '16px' } }, results.flags.map((f) =>
        h('div', { class: 'flag', role: 'alert' }, h('h2', null, 'Needs your attention first'), h('p', null, f.message)))) : null,
      h('div', { class: 'stack', style: { marginTop: '16px' } }, results.domains.map((d) => {
        const labels = BAND_LABEL[d.polarity] ?? BAND_LABEL.risk;
        return h('section', { class: `card domain ${d.band}` },
          h('h3', null, d.label, h('span', { class: `chip ${d.band}` }, labels[d.band])),
          h('div', { class: `bar ${d.band}`, role: 'img', 'aria-label': `${d.label}: ${d.score} out of 100` }, h('span', { style: { width: `${d.score}%` } })),
          h('p', { class: 'small muted' }, `${d.score} / 100 · ${d.polarity === 'risk' ? 'higher means more to explore' : 'higher means stronger'}`),
          h('p', null, d.guidance));
      })),
      h('details', { class: 'card noprint', style: { marginTop: '16px' } },
        h('summary', null, 'About this summary'),
        h('p', { style: { marginTop: '12px' } }, results.disclaimer),
        results.status === 'draft' ? h('p', { class: 'small muted' }, 'Content status: draft. Bands are provisional and the content has not yet been reviewed by a licensed psychologist.') : null),
      h('p', { class: 'print-only' }, results.disclaimer),
      h('div', { class: 'row noprint', style: { marginTop: '24px' } }, eraseBtn,
        h('span', { class: 'muted small' }, 'Sessions are also erased automatically when the retention period ends.')));
  } catch (err) {
    mount(root, errorBox(err.status === 404 ? 'This session has ended or expired.' : err.message));
  }
}
