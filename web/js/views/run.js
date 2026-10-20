import { api } from '../api.js';
import { state } from '../state.js';
import { h, mount, errorBox, pageTitle } from '../ui.js';
import { packIcon, packTone } from '../icons.js';

export async function runView(root, sessionId) {
  try {
    const session = await api.session(sessionId);
    if (session.status === 'completed') { location.hash = `#/done/${sessionId}`; return; }
    let detail = state.packs.get(session.packId);
    if (!detail) { detail = await api.pack(session.packId); state.packs.set(session.packId, detail); }
    pageTitle(detail.patientView.title);
    const view = detail.patientView;
    const tone = `tone-${packTone(session.packId)}`;
    const cheerFor = (i, n) => (i === 0 ? 'Take your time. There are no right or wrong answers.' : i === n - 1 ? 'Last one. You are doing great!' : i === Math.floor(n / 2) ? 'Halfway there. Well done!' : '');
    const steps = view.format === 'checkin' ? view.items : view.scenarios;
    const answers = {};
    let index = 0;
    const save = (key, value) => api.save(sessionId, { [key]: value });

    const finish = async () => {
      try {
        await api.complete(sessionId);
        location.hash = `#/done/${sessionId}`;
      } catch (err) { mount(root, errorBox(err.message)); }
    };

    const render = () => {
      const step = steps[index];
      const last = index === steps.length - 1;
      const pct = Math.round((index / steps.length) * 100);
      const err = h('div');
      const next = h('button', { class: 'btn', disabled: answers[step.id] === undefined, onClick: () => (last ? finish() : (index += 1, render())) }, last ? 'Finish' : 'Next');
      const back = index > 0 ? h('button', { class: 'btn ghost', onClick: () => { index -= 1; render(); } }, 'Back') : null;

      const choose = async (value) => {
        answers[step.id] = value;
        err.replaceChildren();
        try { await save(step.id, value); } catch (e) { err.append(errorBox(e.message)); }
        render();
      };

      let body;
      if (view.format === 'checkin') {
        body = [
          h('p', { class: 'muted' }, view.prompt),
          h('h2', { class: 'q', id: 'q' }, step.text),
          h('div', { class: 'scale', role: 'group', 'aria-labelledby': 'q' }, view.scale.map((s, level) =>
            h('button', { class: 'choice', type: 'button', 'aria-pressed': String(answers[step.id] === s.value), onClick: () => choose(s.value) },
              h('span', { class: 'dots', 'aria-hidden': 'true' }, view.scale.map((_, n) => h('i', { class: n <= level ? 'on' : '' }))),
              s.label))),
        ];
      } else {
        const picked = answers[step.id];
        body = [
          h('h2', { class: 'q' }, step.title),
          h('div', { class: 'story' }, h('p', { class: 'small muted' }, step.setting), h('p', null, step.story)),
          h('p', { class: 'muted' }, 'What would you do?'),
          h('div', { class: 'choices', role: 'group', 'aria-label': 'Options' }, step.options.map((o) =>
            h('button', { class: 'choice', type: 'button', 'aria-pressed': String(picked === o.id), onClick: () => choose(o.id) }, o.text))),
          picked ? h('div', { 'aria-live': 'polite' },
            h('h3', null, 'What could happen'),
            step.options.map((o) => h('div', { class: `outcome${o.id === picked ? ' picked' : ''}` },
              h('strong', null, o.id === picked ? 'You chose: ' : 'Another choice: '), o.text, h('p', { class: 'small' }, o.outcome)))) : null,
        ];
      }
      root.className = tone;
      mount(root, h('div', { class: 'patient' },
        h('div', { class: 'runhead' }, packIcon(session.packId), h('div', null, h('strong', null, view.title), h('div', { class: 'small muted' }, `${index + 1} of ${steps.length}`))),
        h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('span', { style: { width: `${pct}%` } })),
        h('div', { class: 'cheer', 'aria-live': 'polite' }, cheerFor(index, steps.length)),
        body, err,
        h('div', { class: 'row', style: { marginTop: '20px' } }, back, next)));
    };
    render();
  } catch (err) { mount(root, errorBox(err.status === 404 ? 'This session has ended or expired.' : err.message)); }
}
