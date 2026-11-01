import { api } from '../api.js';
import { h, mount, errorBox, pageTitle } from '../ui.js';

let adminKey = '';

/** Sukoon team page: create institutes, share invite codes, pause, extend or cap usage. */
export function adminView(root) {
  pageTitle('Institute admin');
  if (!adminKey) { keyForm(root); return; }
  refresh(root);
}

function keyForm(root) {
  const slot = h('div');
  const input = h('input', { type: 'password', id: 'ak', autocomplete: 'off', required: true });
  mount(root, h('div', { style: { maxWidth: '480px', margin: '32px auto' } },
    h('form', { class: 'card stack', onSubmit: async (e) => {
      e.preventDefault();
      slot.replaceChildren();
      try { await api.adminOrgs(input.value.trim()); adminKey = input.value.trim(); refresh(root); }
      catch (err) { slot.append(errorBox(err.status === 401 ? 'That admin key was not recognised.' : err.message)); }
    } },
      h('h2', { style: { margin: 0 } }, 'Institute admin'),
      h('div', { class: 'field' }, h('label', { for: 'ak' }, 'Admin key'), input, h('p', { class: 'hint' }, 'For the Sukoon team only. It is kept in memory and forgotten when you close this page.')),
      slot, h('button', { class: 'btn', type: 'submit' }, 'Open admin'))));
}

async function refresh(root) {
  try {
    const { orgs } = await api.adminOrgs(adminKey);
    const usage = await api.adminUsage(adminKey).catch(() => ({ orgs: [] }));
    const totals = new Map(usage.orgs.map((u) => [u.id, u.totals]));
    const feedback = await api.adminFeedback(adminKey).catch(() => null);
    mount(root,
      h('h1', null, 'Institutes'),
      createForm(root),
      h('div', { class: 'stack', style: { marginTop: '18px' } }, orgs.length ? orgs.map((o) => orgCard(root, o, totals.get(o.id))) : h('p', { class: 'muted' }, 'No institutes yet. Create the first one above.')),
      feedback ? feedbackCard(feedback.feedback) : null);
  } catch (err) {
    if (err.status === 401) { adminKey = ''; keyForm(root); return; }
    mount(root, errorBox(err.message));
  }
}

function createForm(root) {
  const slot = h('div');
  const name = h('input', { type: 'text', id: 'on', required: true, maxlength: 80 });
  const limit = h('input', { type: 'number', id: 'ol', min: 0, value: 200 });
  const end = h('input', { type: 'date', id: 'oe' });
  return h('form', { class: 'card stack', onSubmit: async (e) => {
    e.preventDefault();
    slot.replaceChildren();
    try {
      await api.adminCreate(adminKey, { name: name.value.trim(), monthlySessionLimit: Number(limit.value), expiresAt: end.value ? new Date(`${end.value}T23:59:59Z`).toISOString() : null });
      refresh(root);
    } catch (err) { slot.append(errorBox(err.message)); }
  } },
    h('h2', { style: { margin: 0 } }, 'Add an institute (free pilot)'),
    h('div', { class: 'field' }, h('label', { for: 'on' }, 'Name'), name),
    h('div', { class: 'row' },
      h('div', { class: 'field' }, h('label', { for: 'ol' }, 'Sessions per month'), limit),
      h('div', { class: 'field' }, h('label', { for: 'oe' }, 'Access ends (optional)'), end)),
    slot, h('div', null, h('button', { class: 'btn', type: 'submit' }, 'Create institute')));
}

function orgCard(root, o, totals) {
  const slot = h('div');
  const people = h('div', { class: 'stack' });
  const act = (patch) => async () => {
    slot.replaceChildren();
    try { await api.adminUpdate(adminKey, o.id, patch); refresh(root); } catch (err) { slot.append(errorBox(err.message)); }
  };
  const limit = h('input', { type: 'number', min: 0, value: o.monthlySessionLimit, 'aria-label': `Monthly limit for ${o.name}`, style: { maxWidth: '110px' } });
  const extend = () => { const base = o.expiresAt && o.expiresAt > new Date().toISOString() ? new Date(o.expiresAt) : new Date(); base.setDate(base.getDate() + 30); return base.toISOString(); };
  return h('div', { class: 'card stack' },
    h('div', { class: 'row between' },
      h('h3', { style: { margin: 0 } }, o.name),
      h('div', { class: 'row' },
        h('span', { class: 'chip' }, o.plan === 'paid' ? 'Paid' : 'Free pilot'),
        h('span', { class: `chip ${o.paused ? 'explore' : 'ok'}` }, o.paused ? 'Paused' : 'Active'))),
    h('p', { style: { margin: 0 } }, 'Invite code: ', h('strong', { class: 'code' }, o.inviteCode)),
    h('p', { class: 'muted small', style: { margin: 0 } }, `${o.users} psychologist${o.users === 1 ? '' : 's'} | ${o.sessionsThisMonth} of ${o.monthlySessionLimit} sessions this month | ${o.expiresAt ? `ends ${o.expiresAt.slice(0, 10)}` : 'no end date'}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn small ghost', type: 'button', onClick: act({ paused: !o.paused }) }, o.paused ? 'Resume' : 'Pause'),
      h('button', { class: 'btn small ghost', type: 'button', onClick: act({ expiresAt: extend() }) }, 'Extend 30 days'),
      limit,
      h('button', { class: 'btn small ghost', type: 'button', onClick: () => act({ monthlySessionLimit: Number(limit.value) })() }, 'Save limit'),
      o.plan === 'free-pilot' ? h('button', { class: 'btn small ghost', type: 'button', onClick: act({ plan: 'paid' }) }, 'Mark as paid') : null),
    totals ? h('p', { class: 'muted small', style: { margin: 0 } }, `Last 30 days: ${totals.created} sessions started, ${totals.completed} finished`) : null,
    h('div', null, h('button', { class: 'btn small ghost', type: 'button', onClick: () => showUsers(o, people) }, 'Psychologists')),
    people, slot);
}

async function showUsers(o, box) {
  box.replaceChildren();
  try {
    const { users } = await api.adminUsers(adminKey, o.id);
    box.append(users.length ? users.map((u) => {
      const out = h('span', { class: 'small', role: 'status' });
      return h('div', { class: 'row between' },
        h('span', null, `${u.name} (${u.email})`),
        h('span', { class: 'row' }, out, h('button', { class: 'btn small ghost', type: 'button', onClick: async () => {
          if (!confirm(`Set a new temporary password for ${u.name}?`)) return;
          try { const r = await api.adminReset(adminKey, u.id); out.replaceChildren('Temporary password, shown once: ', h('strong', { class: 'code' }, r.temporaryPassword)); }
          catch (err) { out.textContent = err.message; }
        } }, 'Reset password')));
    }) : h('p', { class: 'muted small' }, 'No psychologists have joined yet.'));
  } catch (err) { box.append(errorBox(err.message)); }
}

function feedbackCard(list) {
  return h('section', { class: 'card', style: { marginTop: '18px' } }, h('h2', null, 'Feedback'),
    list.length ? h('ul', null, list.map((f) => h('li', null, `${f.at.slice(0, 10)} · ${f.rating}/5 · ${f.page} · ${f.text}`))) : h('p', { class: 'muted' }, 'Nothing yet.'));
}
