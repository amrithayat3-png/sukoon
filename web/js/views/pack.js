import { api } from '../api.js';
import { state } from '../state.js';
import { h, mount, link, errorBox, pageTitle } from '../ui.js';

export async function packView(root, packId) {
  try {
    const detail = await api.pack(packId);
    state.packs.set(packId, detail);
    const s = detail.summary;
    pageTitle(s.title);
    const alias = h('input', { type: 'text', id: 'alias', maxlength: 40, autocomplete: 'off', 'aria-describedby': 'alias-hint' });
    const pin = h('input', { type: 'text', id: 'pin', inputmode: 'numeric', pattern: '[0-9]{4}', maxlength: 4, autocomplete: 'off', 'aria-describedby': 'pin-hint' });
    const slot = h('div');
    const start = h('button', { class: 'btn', type: 'submit' }, 'Start session');
    const form = h('form', { class: 'card stack', onSubmit: async (e) => {
      e.preventDefault();
      slot.replaceChildren();
      const code = pin.value.trim();
      if (code && !/^\d{4}$/.test(code)) { slot.append(errorBox('The return PIN must be exactly 4 digits.')); return; }
      start.disabled = true;
      try {
        const session = await api.createSession(packId, alias.value.trim() || undefined);
        if (code) state.locks.set(session.id, code);
        location.hash = `#/run/${session.id}`;
      } catch (err) { slot.append(errorBox(err.message)); start.disabled = false; }
    } },
      h('h2', null, 'Start a session'),
      h('div', { class: 'field' },
        h('label', { for: 'alias' }, 'Label for this session (optional)'),
        alias,
        h('p', { class: 'hint', id: 'alias-hint' }, 'Use initials or a nickname only. Never a full name, phone number or other identifier.')),
      h('div', { class: 'field' },
        h('label', { for: 'pin' }, 'Return PIN (optional)'),
        pin,
        h('p', { class: 'hint', id: 'pin-hint' }, 'A 4-digit code so the screen is handed back to you before results are shown. This is a courtesy lock for the room, not a security feature.')),
      slot, start);
    mount(root,
      h('div', { class: 'crumbs' }, link('#/', 'All tracks'), ' / ', link(`#/track/${s.track}`, s.track), ' / ', s.title),
      h('div', { class: 'row' },
        h('span', { class: 'chip' }, s.format === 'checkin' ? 'Check-in' : 'Scenarios'),
        s.status === 'draft' ? h('span', { class: 'chip draft' }, 'Draft') : null,
        h('span', { class: 'muted small' }, `About ${s.estimatedMinutes} min`)),
      h('h1', null, s.title),
      h('p', null, s.summary),
      s.status === 'draft' ? h('div', { class: 'notice' }, 'This content is a draft and has not been reviewed by a licensed psychologist. Review it before using it with patients.') : null,
      h('div', { class: 'stack' },
        form,
        s.clinicianNotes ? h('details', { class: 'card' }, h('summary', null, 'Clinician notes'), h('p', null, s.clinicianNotes)) : null,
        h('details', { class: 'card' },
          h('summary', null, `Research basis (${detail.references.length})`),
          h('p', { class: 'muted small' }, 'Topic areas are informed by this published work. Items are original wording.'),
          h('ul', { class: 'refs' }, detail.references.map((r) =>
            h('li', null, r.citation, ' ',
              r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open source') : null,
              r.verified ? null : h('span', { class: 'chip draft' }, 'Not yet verified')))),
          link('#/references', 'View all references')))
    );
  } catch (err) { mount(root, errorBox(err.status === 404 ? 'That activity was not found.' : err.message)); }
}
