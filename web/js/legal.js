import { h, link, mount, pageTitle } from './ui.js';

/** Fill these in once. They appear in the privacy policy, terms and consent text. */
export const ORG = {
  org: '[ORGANISATION NAME]',
  email: '[EMAIL]',
  address: '[ADDRESS]',
  city: '[CITY]',
  date: '[DATE]',
  hosting: '[HOSTING PROVIDER]',
  database: '[DATABASE PROVIDER]',
  hours: '24',
  replyDays: '30',
  pilot: '[1 to 2]',
};

export const SAFETY_LINE = 'If you or someone else is in danger, contact local emergency services or a trusted adult right away. This app is not monitored live.';

export const CONSENT_ADULT = `This activity is a conversation starter for your session with your psychologist. It is not a diagnosis. Please use only initials or a nickname. Your answers are encrypted and deleted automatically after ${ORG.hours} hours, and you can ask to have them erased sooner.`;
export const CONSENT_GUARDIAN = `I am the parent or legal guardian of the young person who will take part. I understand this activity is a conversation starter with their professional, not a diagnosis. Only a nickname or initials are used, answers are deleted automatically after ${ORG.hours} hours, and I may ask for earlier deletion.`;

const PRIVACY = [
  ['What we collect', [
    'The answers given during an activity.',
    'Optional taps around an activity (inner weather, body areas, a "what I noticed" choice) and the private notes a psychologist types.',
    'An optional nickname or initials. Please never use a full name.',
    'A session code and the time of the session.',
    'For psychologists: name, work email and institute, so they can sign in. Feedback you choose to send, and simple counts of sessions per institute per day (numbers only, no answers).',
  ]],
  ['What we do not collect', [
    'No names, phone numbers, ID numbers, location, camera or microphone.',
    'No advertising, no tracking profiles, and we never sell data.',
  ]],
  ['Who can see it', [
    'The psychologist who ran the session, and nobody at other institutes.',
    `Our hosting providers (${ORG.hosting} and ${ORG.database}), only to keep the app running.`,
    'Anyone the law requires us to tell.',
  ]],
  ['How long we keep it', [
    `Session answers, taps and notes are deleted after ${ORG.hours} hours, or sooner if the psychologist deletes them. Account details stay until the account is closed.`,
  ]],
  ['How we protect it', [
    'Everything travels over HTTPS, and answers, nicknames and notes are encrypted when stored.',
  ]],
  ['Children', ['A parent or guardian must agree before anyone under 18 uses the app. The psychologist arranges this.']],
  ['Emergencies', ['Nobody watches the app live. If someone is in danger, contact emergency services or a trusted adult right away.']],
  ['Your choices and contact', [
    `You can ask us to show, fix or delete your data. Write to ${ORG.email} and we reply within ${ORG.replyDays} days.`,
    `Run by ${ORG.org}, ${ORG.address}. Last updated ${ORG.date}.`,
  ]],
];

const TERMS = [
  ['1. What Sukoon is', 'Sukoon is a set of guided check-ins, questionnaires and "choose what happens next" activities that a licensed psychologist or clinic can use during a session. It helps start conversations. It does not replace the professional\'s own judgement.'],
  ['2. What Sukoon is not', ['It is not a diagnosis, a medical test or a treatment.', 'Scores are conversation aids. Our own activities have not been validated as clinical tools; published questionnaires use their published scoring but have no local norms yet.', 'It is not an emergency or crisis service and is not monitored in real time.']],
  ['3. Who may use it', ['Professionals must hold the licence or registration their work requires and use Sukoon within their professional duties.', 'Clients should use it only with, or at the request of, their professional.', 'Children and teenagers (under 18) may use it only with a parent or guardian\'s agreement, obtained by the professional.']],
  ['4. Responsibilities of the professional', ['Explain to the client what the activity is for, and get consent (and guardian consent for minors) before starting.', 'Review results with the client and decide what, if anything, follows. Sukoon makes no clinical decisions.', 'Respond to any safety flag according to your professional and legal duties.', 'Use only initials or a nickname, never a full name or other identifying details.', 'Keep any printed or saved results as your professional rules require.']],
  ['5. Acceptable use', 'Do not misuse the app. That includes trying to break or overload it, accessing sessions that are not yours, copying the content for resale, or using it to harm, harass or deceive anyone.'],
  ['6. Content and references', 'Our own activities are original wording informed by published research. Published questionnaires keep their published wording and are credited to their authors, with licences shown in the app. During the pilot, the content is a draft and may change. We do not promise that it is complete or suitable for every person or culture.'],
  ['7. Pilot period and fees', `Sukoon is offered free during a pilot period of about ${ORG.pilot} months. After that we may introduce fees. We will tell you before any charge applies, and nothing is charged without your agreement.`],
  ['8. Availability', 'We work to keep Sukoon running but do not guarantee it will always be available or error free. We may change or stop features, with notice where we reasonably can.'],
  ['9. Ownership', `The app, wording, design and drawings belong to ${ORG.org} or its licensors. You may use them for your professional work with Sukoon. You may not copy, resell or build a competing product from them without written permission. Your own answers remain yours.`],
  ['10. Limits of our responsibility', `Sukoon is provided "as is". To the extent the law allows, ${ORG.org} is not responsible for decisions made using the app, for loss caused by outages or errors, or for indirect losses. Nothing here limits responsibility that the law does not allow to be limited, including for death or personal injury caused by negligence or for fraud.`],
  ['11. Ending use', 'We may suspend access if these terms are broken. You may stop using Sukoon at any time and ask for your data to be deleted as described in the Privacy Policy.'],
  ['12. Governing law', `These terms are governed by the laws of Pakistan. Disputes will be handled by the courts of ${ORG.city}, Pakistan, unless the law requires otherwise.`],
  ['13. Changes and contact', `We may update these terms and will change the date at the top. Continuing to use Sukoon after an update means you accept it. Questions: ${ORG.email}.`],
];

const draftNotice = () => h('div', { class: 'notice' }, 'Working draft, not legal advice. Items in [square brackets] must be filled in, and a lawyer should review this before you charge anyone.');

export function privacyView(root) {
  pageTitle('Privacy Policy');
  mount(root,
    h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / Privacy'),
    h('h1', null, 'Privacy Policy'),
    draftNotice(),
    h('p', { class: 'lead' }, 'Short version: we keep very little, we never sell it, and we delete it.'),
    h('div', { class: 'card stack legal' }, PRIVACY.map(([title, items]) => h('section', null, h('h3', null, title), h('ul', null, items.map((i) => h('li', null, i)))))));
}

export function termsView(root) {
  pageTitle('Terms of Use');
  mount(root,
    h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / Terms'),
    h('h1', null, 'Terms of Use'),
    draftNotice(),
    h('p', null, 'By using Sukoon you agree to these terms. If you do not agree, please do not use the app.'),
    h('div', { class: 'card stack legal' }, TERMS.map(([title, body]) => h('section', null, h('h3', null, title),
      Array.isArray(body) ? h('ul', null, body.map((i) => h('li', null, i))) : h('p', null, body)))));
}

/** Consent step shown before a session starts. The clinician ticks it on the person's behalf after explaining. */
export function consentBlock(onChange) {
  let guardian = false;
  const text = h('p', { id: 'consent-text' }, CONSENT_ADULT);
  const box = h('input', { type: 'checkbox', id: 'consent-ok', onChange: () => onChange(box.checked) });
  const who = h('select', { id: 'consent-who', 'aria-label': 'Who is taking part', onChange: () => {
    guardian = who.value === 'young';
    text.textContent = guardian ? CONSENT_GUARDIAN : CONSENT_ADULT;
  } },
    h('option', { value: 'adult' }, 'An adult'),
    h('option', { value: 'young' }, 'A child or teenager (guardian agrees)'));
  const node = h('section', { class: 'card consent' },
    h('h2', null, 'Before we start'),
    h('div', { class: 'field' }, h('label', { for: 'consent-who' }, 'This session is for'), who),
    text,
    h('p', { class: 'small' }, h('a', { href: '#/privacy', target: '_blank', rel: 'noopener' }, 'Privacy Policy'), ' and ', h('a', { href: '#/terms', target: '_blank', rel: 'noopener' }, 'Terms of Use'), ' (open in a new tab).'),
    h('p', { class: 'safety-line' }, SAFETY_LINE),
    h('label', { class: 'check', for: 'consent-ok' }, box, h('span', null, 'I have explained this and the person (or their guardian) agrees to continue.')));
  return { node, checked: () => box.checked };
}
