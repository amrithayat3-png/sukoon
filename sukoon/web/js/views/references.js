import { api } from '../api.js';
import { h, mount, link, errorBox, pageTitle } from '../ui.js';

export async function referencesView(root) {
  pageTitle('Research and references');
  try {
    const { references } = await api.references();
    mount(root,
      h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / References'),
      h('h1', null, 'Research and references'),
      h('p', { class: 'muted' }, 'Sukoon activities are informed by published research and public-health guidance. Items are original wording; none are copied from, or presented as, validated instruments. References marked "Not yet verified" still need a source check before the content is finalised.'),
      h('div', { class: 'card' }, h('ul', { class: 'refs' }, references.map((r) =>
        h('li', null, r.citation, ' ',
          r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open source') : null, ' ',
          r.verified ? h('span', { class: 'chip ok' }, 'Verified') : h('span', { class: 'chip draft' }, 'Not yet verified'),
          r.note ? h('div', { class: 'muted small' }, r.note) : null)))));
  } catch (err) { mount(root, errorBox(err.message)); }
}
