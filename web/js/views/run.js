import { api } from '../api.js';
import { state } from '../state.js';
import { h, mount, errorBox, pageTitle } from '../ui.js';
import { packIcon, packTone } from '../icons.js';
import { worldArt } from '../worlds.js';
import { openPause, readAloud, seedling } from '../extras.js';

export async function runView(root, sessionId) {
  try {
    const session = await api.session(sessionId);
    if (session.status === 'completed') { location.hash = `#/done/${sessionId}`; return; }
    let detail = state.packs.get(session.packId);
    if (!detail) { detail = await api.pack(session.packId); state.packs.set(session.packId, detail); }
    pageTitle(detail.patientView.title);
    const view = detail.patientView;
    const tone = `tone-${packTone(session.packId)}`;
    const cheerFor = (i, n) => (i === 0 ? (state.mood === 'stormy' || state.mood === 'rainy' ? 'Thank you for being here. We will go gently, one step at a time.' : 'Take your time. There are no right or wrong answers.') : i === n - 1 ? 'Last one. You are doing great!' : i === Math.floor(n / 2) ? 'Halfway there. Well done!' : '');
    const steps = view.format === 'scenario' ? view.scenarios : view.items;
    // Answers already saved on the server (after a refresh) come back with the session.
    const answers = { ...(session.responses || {}) };
    const unsaved = new Set();
    let index = steps.findIndex((s) => answers[s.id] === undefined);
    if (index < 0) index = steps.length - 1;
    const save = (key, value) => api.save(sessionId, { [key]: value });

    // On Finish, resend anything that failed to save, retry briefly, then complete.
    const flush = async () => {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          if (unsaved.size) {
            const batch = Object.fromEntries([...unsaved].map((k) => [k, answers[k]]));
            await api.save(sessionId, batch);
            unsaved.clear();
          }
          await api.complete(sessionId);
          return;
        } catch (e) {
          lastError = e;
          if (e.status && e.status < 500 && e.status !== 0) break;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
      throw lastError;
    };
    const finish = async (err) => {
      err.replaceChildren(h('p', { class: 'muted', role: 'status' }, 'Saving your answers...'));
      try {
        await flush();
        location.hash = `#/done/${sessionId}`;
      } catch (e) {
        err.replaceChildren(errorBox(`${e.message} Your answers are still here. Please press Finish again.`));
      }
    };

    const render = () => {
      const step = steps[index];
      const last = index === steps.length - 1;
      const pct = Math.round((index / steps.length) * 100);
      const err = h('div');
      const next = h('button', { class: 'btn', disabled: answers[step.id] === undefined, onClick: () => (last ? finish(err) : (index += 1, render())) }, last ? 'Finish' : 'Next');
      const back = index > 0 ? h('button', { class: 'btn ghost', onClick: () => { index -= 1; render(); } }, 'Back') : null;

      const choose = async (value) => {
        answers[step.id] = value;
        err.replaceChildren();
        unsaved.add(step.id);
        try { await save(step.id, value); unsaved.delete(step.id); } catch { /* kept in memory and resent on Finish */ }
        render();
      };

      let body;
      if (view.format !== 'scenario') {
        body = [
          h('p', { class: 'muted' }, view.prompt),
          view.timeframe ? h('p', null, h('span', { class: 'chip timeframe' }, view.timeframe)) : null,
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
      const speak = readAloud(() => (view.format === 'scenario' ? `${step.title}. ${step.story}` : `${view.timeframe ? `${view.timeframe}. ` : ''}${step.text}`));
      const stage = Math.min(5, Math.floor((index / steps.length) * 6) + (last ? 1 : 0));
      root.className = `${tone}${detail.summary.track === 'seniors' ? ' senior' : ''}`;
      mount(root, h('div', { class: 'patient' },
        h('div', { class: 'strip' }, worldArt(detail.summary.track, 'world-art')),
        h('div', { class: 'runhead' }, packIcon(session.packId), h('div', { class: 'grow' }, h('strong', null, view.title), h('div', { class: 'small muted' }, `${index + 1} of ${steps.length}`)), seedling(stage)),
        h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('span', { style: { width: `${pct}%` } })),
        h('div', { class: 'cheer', 'aria-live': 'polite' }, cheerFor(index, steps.length)),
        body, err,
        h('div', { class: 'row', style: { marginTop: '20px' } }, back, next),
        h('div', { class: 'row between runtools noprint' }, speak, h('button', { class: 'btn ghost small', type: 'button', onClick: openPause }, 'Take a pause')),
        detail.summary.source ? h('p', { class: 'small muted source-line' }, `Source: ${detail.summary.source.attribution}`) : null));
    };
    render();
  } catch (err) { mount(root, errorBox(err.status === 404 ? 'This session has ended or expired.' : err.message)); }
}
