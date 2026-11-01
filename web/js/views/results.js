import { api } from '../api.js';
import { state } from '../state.js';
import { BAND_LABEL, h, mount, link, errorBox, pageTitle } from '../ui.js';
import { packIcon } from '../icons.js';
import { homeworkSheet } from '../extras.js';

const printMode = (cls) => {
  document.body.classList.add(cls);
  const clean = () => { document.body.classList.remove(cls); window.removeEventListener('afterprint', clean); };
  window.addEventListener('afterprint', clean);
  window.print();
};

function domainCard(d) {
  const labels = BAND_LABEL[d.polarity] ?? BAND_LABEL.risk;
  const banded = d.banded !== false;
  const published = d.raw !== undefined;
  return h('section', { class: `card domain ${banded ? d.band : 'plain'}` },
    h('h3', null, d.label, banded ? h('span', { class: `chip ${d.band}` }, d.level ?? labels[d.band]) : null),
    h('div', { class: `bar ${banded ? d.band : 'plain'}`, role: 'img', 'aria-label': `${d.label}: ${d.score} out of 100` }, h('span', { style: { width: `${d.score}%` } })),
    h('p', { class: 'small muted' },
      published ? `Score ${d.raw} (possible ${d.rawMin} to ${d.rawMax})` : `${d.score} / 100`,
      published ? '' : ` · ${d.polarity === 'risk' ? 'higher means more to explore' : 'higher means stronger'}`,
      published && !banded ? ' · No published cut-offs, so no colour meaning' : ''),
    d.referenceLines?.length ? h('ul', { class: 'reflines small' }, d.referenceLines.map((r) =>
      h('li', null, `${r.label}: ${r.value}. ${r.reached ? 'Score is at or above this reference value.' : 'Score is below this reference value.'}`))) : null,
    h('p', null, d.guidance));
}

export async function resultsView(root, sessionId) {
  pageTitle('Session summary');
  try {
    const { session, results } = await api.results(sessionId);
    const [pack, refs, library] = await Promise.all([
      api.pack(results.packId).catch(() => null),
      api.references().catch(() => ({ references: [] })),
      api.homework().catch(() => ({ cards: [] })),
    ]);
    const cards = library.cards ?? [];
    let chosen = session.homework.map((c) => c.id);
    const sheetSlot = h('div', { class: 'sheet-slot' });
    const saveNote = h('span', { class: 'small muted', role: 'status' });
    const status = (text) => { saveNote.textContent = text; };

    const drawSheet = () => sheetSlot.replaceChildren(homeworkSheet(cards.filter((c) => chosen.includes(c.id)), session));
    drawSheet();

    const notes = h('textarea', { id: 'notes', rows: 6, maxlength: 4000, autocomplete: 'off' });
    notes.value = session.notes ?? '';
    const notesPrint = h('p', { class: 'print-only notes-print' }, session.notes ?? '');
    const saveNotes = async () => {
      try { await api.extras(sessionId, { notes: notes.value }); notesPrint.textContent = notes.value.trim(); status('Notes saved.'); }
      catch (e) { status(e.message); }
    };

    const picker = h('div', { class: 'stack' }, cards.map((c) => {
      const box = h('input', { type: 'checkbox', id: `hw-${c.id}` });
      box.checked = chosen.includes(c.id);
      box.addEventListener('change', async () => {
        chosen = box.checked ? [...chosen, c.id] : chosen.filter((x) => x !== c.id);
        drawSheet();
        try { await api.extras(sessionId, { homework: chosen }); status('Homework saved.'); } catch (e) { status(e.message); }
      });
      return h('label', { class: 'check', for: `hw-${c.id}` }, box, h('span', null, h('strong', null, c.title), ` · about ${c.minutes} min`, h('span', { class: 'small muted block' }, c.why)));
    }));

    const download = () => {
      const blob = new Blob([JSON.stringify({ session, results }, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `sukoon-${session.code}.json` });
      document.body.append(a); a.click(); a.remove();
    };
    const erase = async (btn) => {
      if (!confirm('Erase this session and its answers now? This cannot be undone.')) return;
      btn.disabled = true;
      try { await api.erase(sessionId); state.queue = null; location.hash = '#/'; } catch (e) { mount(root, errorBox(e.message)); }
    };
    const eraseBtn = h('button', { class: 'btn danger', onClick: () => erase(eraseBtn) }, 'Erase session now');

    const q = state.queue;
    const others = q && q.sessionIds.includes(sessionId) ? q.sessionIds.map((id, i) => ({ id, i })).filter((s) => s.id !== sessionId) : [];
    const refList = (pack?.references ?? []).map((id) => refs.references.find((r) => r.id === id)).filter(Boolean);
    const checks = [session.moodStart && `Weather before: ${session.moodStart.label}`, session.moodEnd && `Weather after: ${session.moodEnd.label}`,
      session.reflection && `Reflection: ${session.reflection.label}`].filter(Boolean);

    mount(root,
      h('div', { class: 'crumbs noprint' }, link('#/', 'Home'), ' / Session summary'),
      h('div', { class: 'report' },
        h('div', { class: 'print-only print-head' }, h('strong', null, 'Sukoon session summary'), h('span', null, ' · For the psychologist. Not for the client record without review.')),
        h('div', { class: 'row between' },
          h('div', { class: 'row' },
            packIcon(results.packId),
            h('div', null, h('h1', { style: { margin: 0 } }, pack?.title ?? 'Session summary'),
              h('p', { class: 'muted small', style: { margin: 0 } }, `Code ${session.code}`, session.alias ? ` · ${session.alias}` : '', ` · ${new Date(session.completedAt).toLocaleString()}`))),
          h('div', { class: 'row noprint' },
            h('button', { class: 'btn small', onClick: () => printMode('print-report') }, 'Print report'),
            h('button', { class: 'btn ghost small', onClick: download }, 'Download JSON'))),
        results.flags.length ? h('div', { class: 'stack', style: { marginTop: '16px' } }, results.flags.map((f) =>
          h('div', { class: 'flag', role: 'alert' }, h('h2', null, 'Needs your attention first'), h('p', null, f.message)))) : null,
        h('div', { class: 'stack', style: { marginTop: '16px' } }, results.domains.map(domainCard)),
        results.highlights?.length ? h('section', { class: 'card', style: { marginTop: '16px' } },
          h('h2', null, 'Items to look at together'),
          h('p', { class: 'small muted' }, 'These are not alerts. They are answers that may be worth a gentle conversation.'),
          h('ul', null, results.highlights.map((x) => h('li', null, `${x.text} (answered: ${x.answerLabel})`)))) : null,
        checks.length || session.bodyMap.length ? h('section', { class: 'card', style: { marginTop: '16px' } },
          h('h2', null, 'How the person felt'),
          checks.length ? h('ul', null, checks.map((c) => h('li', null, c))) : null,
          session.bodyMap.length ? h('p', null, `Felt in the body: ${session.bodyMap.map((z) => z.label).join(', ')}`) : null) : null,
        h('section', { class: 'notes-print-block print-only' }, h('h2', null, 'Session notes'), notesPrint),
        refList.length || pack?.source ? h('section', { class: 'print-only sources' },
          h('h2', null, 'Sources'),
          pack?.source ? h('p', null, pack.source.attribution) : null,
          h('ul', null, refList.map((r) => h('li', null, r.citation)))) : null,
        h('p', { class: 'print-only' }, results.disclaimer)),

      h('section', { class: 'card noprint', style: { marginTop: '16px' } },
        h('h2', null, 'Session notes'),
        h('p', { class: 'small muted' }, 'Private to you. Stored with this session only and erased with it.'),
        h('div', { class: 'field' }, h('label', { for: 'notes', class: 'sr-only' }, 'Session notes'), notes),
        h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', onClick: saveNotes }, 'Save notes'), saveNote)),

      h('section', { class: 'card noprint', style: { marginTop: '16px' } },
        h('h2', null, 'Homework cards'),
        h('p', { class: 'small muted' }, 'Tick the practices to send home. These are draft cards for your review.'),
        picker,
        h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', onClick: () => (chosen.length ? printMode('print-card') : status('Choose at least one card first.')) }, 'Print homework card'))),
      sheetSlot,

      others.length ? h('section', { class: 'card noprint', style: { marginTop: '16px' } },
        h('h2', null, 'Other activities in this set'),
        h('div', { class: 'row' }, others.map((s) => link(`#/results/${s.id}`, `Activity ${s.i + 1}`, 'btn ghost small')))) : null,

      h('details', { class: 'card noprint', style: { marginTop: '16px' } },
        h('summary', null, 'About this summary'),
        h('p', { style: { marginTop: '12px' } }, results.disclaimer),
        results.status === 'draft' ? h('p', { class: 'small muted' }, 'Content status: draft. The content has not yet been reviewed by a licensed psychologist.') : null),
      h('div', { class: 'row noprint', style: { marginTop: '24px' } }, eraseBtn,
        h('span', { class: 'muted small' }, 'Sessions are also erased automatically when the retention period ends.')));
  } catch (err) {
    mount(root, errorBox(err.status === 404 ? 'This session has ended or expired.' : err.message));
  }
}
