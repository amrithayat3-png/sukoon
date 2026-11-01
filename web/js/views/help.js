import { api } from '../api.js';
import { SAFETY_LINE } from '../legal.js';
import { errorBox, h, link, mount, pageTitle } from '../ui.js';

/** Help now page. Public so it works before sign-in and from the patient screens. Numbers are supplied by the psychologist. */
export async function helpView(root) {
  pageTitle('Help now');
  try {
    const info = await api.help();
    mount(root,
      h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / Help now'),
      h('h1', null, 'Help now'),
      h('div', { class: 'flag' }, h('p', { style: { margin: 0 } }, info.emergency)),
      h('p', { class: 'lead' }, info.intro),
      h('section', { class: 'card stack' },
        h('h2', null, 'Helplines'),
        info.entries.length
          ? h('ul', { class: 'helplines' }, info.entries.map((e) => h('li', null, h('strong', null, e.name), h('div', { class: 'big-number' }, e.contact), e.detail ? h('div', { class: 'small muted' }, e.detail) : null)))
          : h('p', null, info.emptyNote)),
      h('p', null, link('#/tools', 'Calming tools you can use right now')),
      h('p', { class: 'small muted' }, SAFETY_LINE));
  } catch (err) { mount(root, errorBox(err.message)); }
}
