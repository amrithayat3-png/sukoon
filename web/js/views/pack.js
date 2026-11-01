import { api } from '../api.js';
import { state } from '../state.js';
import { h, mount, link, errorBox, pageTitle } from '../ui.js';
import { packIcon, packTone } from '../icons.js';
import { weatherPicker, worldArt } from '../worlds.js';
import { consentBlock } from '../legal.js';

export async function packView(root, packId) {
  try {
    const detail = await api.pack(packId);
    state.packs.set(packId, detail);
    const s = detail.summary;
    pageTitle(s.title);
    const tone = `tone-${packTone(packId)}`;
    const alias = h('input', { type: 'text', id: 'alias', maxlength: 40, autocomplete: 'off', 'aria-describedby': 'alias-hint' });
    const pin = h('input', { type: 'text', id: 'pin', inputmode: 'numeric', pattern: '[0-9]{4}', maxlength: 4, autocomplete: 'off', 'aria-describedby': 'pin-hint' });
    const slot = h('div');
    const start = h('button', { class: 'btn big', type: 'submit', disabled: true }, 'Start session');
    const consent = consentBlock((ok) => { start.disabled = !ok; });
    const form = h('form', { class: 'stack', onSubmit: async (e) => {
      e.preventDefault();
      slot.replaceChildren();
      const code = pin.value.trim();
      if (code && !/^\d{4}$/.test(code)) { slot.append(errorBox('The return PIN must be exactly 4 digits.')); return; }
      start.disabled = true;
      try {
        const session = await api.createSession(packId, alias.value.trim() || undefined);
        if (code) state.locks.set(session.id, code);
        state.queue = null;
        // Best effort: the activity still runs if this small save fails.
        await api.extras(session.id, { consent: true, ...(state.mood ? { moodStart: state.mood } : {}) }).catch(() => null);
        location.hash = `#/run/${session.id}`;
      } catch (err) { slot.append(errorBox(err.message)); start.disabled = false; }
    } },
      h('details', { class: 'card' },
        h('summary', null, 'Optional: session label and return PIN'),
        h('div', { class: 'field', style: { marginTop: '14px' } },
          h('label', { for: 'alias' }, 'Label for this session'),
          alias,
          h('p', { class: 'hint', id: 'alias-hint' }, 'Initials or a nickname only. Never a full name, phone number or other identifier.')),
        h('div', { class: 'field' },
          h('label', { for: 'pin' }, 'Return PIN'),
          pin,
          h('p', { class: 'hint', id: 'pin-hint' }, 'A 4-digit code so the screen is handed back before results show. A courtesy lock for the room, not a security feature.'))),
      consent.node,
      slot, h('div', null, start));
    mount(root,
      h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / ', link(`#/track/${s.track}`, s.track), ' / ', s.title),
      h('div', { class: `banner world ${tone}` },
        worldArt(s.track),
        h('div', { class: 'banner-text' }, packIcon(packId, true),
        h('div', null,
          h('h1', { style: { margin: 0 } }, s.title),
          h('div', { class: 'row' },
            h('span', { class: 'chip' }, s.format === 'scenario' ? 'Story choices' : 'Questions'),
            h('span', { class: 'chip' }, `About ${s.estimatedMinutes} min`),
            h('span', { class: 'chip' }, `${s.itemCount} ${s.format === 'scenario' ? 'stories' : 'questions'}`))))),
      h('p', { style: { fontSize: '1.08rem' } }, s.summary),
      h('div', { class: 'stack' },
        weatherPicker(state),
        form,
        h('details', { class: 'card' },
          h('summary', null, 'About this activity'),
          s.clinicianNotes ? h('p', { style: { marginTop: '12px' } }, s.clinicianNotes) : null,
          s.status === 'draft' ? h('p', { class: 'small muted' }, 'Content status: draft. It has not yet been reviewed by a licensed psychologist.') : null,
          s.source ? h('div', { class: 'notice' }, h('strong', null, 'Published questionnaire. '), s.source.attribution, ' ',
            h('span', { class: 'chip' }, { 'free-with-citation': 'Free to use with citation', 'open-access-cc-by': 'Open access (CC BY)', 'confirm-before-use': 'Licence to confirm' }[s.source.licence] ?? s.source.licence),
            s.source.wording === 'confirm-with-publisher' ? h('p', { class: 'small' }, 'Wording should be confirmed with the publisher or author before this activity is marked reviewed.') : null) : null,
          h('h3', null, `Research basis (${detail.references.length})`),
          h('p', { class: 'muted small' }, s.source ? 'Items follow the published questionnaire.' : 'Topic areas are informed by this published work. Items are original wording.'),
          h('ul', { class: 'refs' }, detail.references.map((r) =>
            h('li', null, r.citation, ' ',
              r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open source') : null,
              r.verified ? null : h('span', { class: 'chip draft' }, 'Not yet verified')))),
          link('#/references', 'View all references'))));
  } catch (err) { mount(root, errorBox(err.status === 404 ? 'That activity was not found.' : err.message)); }
}
