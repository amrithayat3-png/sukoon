import { h, mount, link, pageTitle } from '../ui.js';
import { state } from '../state.js';

export function aboutView(root) {
  pageTitle('About');
  mount(root,
    h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / About'),
    h('h1', null, 'About Sukoon'),
    h('div', { class: 'card stack' },
      h('p', null, 'Sukoon is a session companion for licensed psychologists. It offers interactive check-ins and scenario activities that help a conversation start, and a summary that helps the clinician decide what to explore.'),
      h('h3', null, 'Important to know'),
      h('ul', null,
        h('li', null, 'Sukoon does not diagnose. Summaries are provisional and support the judgement of a licensed professional.'),
        h('li', null, 'Scoring bands have not been clinically validated.'),
        h('li', null, 'Activity content is draft until reviewed by a licensed psychologist, and should be checked for cultural fit before use with patients.'),
        h('li', null, 'Activity wording is original. Topic areas are informed by published research listed under References.'),
        h('li', null, 'Answers are kept only for the retention period (24 hours by default) and can be erased at any time from the summary page.')),
      h('p', null, link('#/references', 'View the research and references'))));
}
