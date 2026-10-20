/** Tiny DOM helper. Text is always set as text, never as HTML, so data cannot inject markup. */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function mount(root, ...nodes) {
  root.replaceChildren();
  append(root, nodes);
  root.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

export const link = (href, text, cls) => h('a', { href, class: cls }, text);

export const BAND_LABEL = {
  risk: { ok: 'Settled', watch: 'Keep an eye on', explore: 'Worth exploring' },
  protective: { ok: 'Strong', watch: 'Moderate', explore: 'Thin, worth exploring' },
  skill: { ok: 'Strong approach', watch: 'Mixed approach', explore: 'Worth practising' },
};

export function errorBox(message) {
  return h('div', { class: 'error', role: 'alert' }, message);
}

export function pageTitle(text) {
  document.title = `${text} | Sukoon`;
}
