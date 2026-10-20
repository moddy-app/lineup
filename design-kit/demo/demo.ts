/**
 * The demo page: a Moddy Network profile and feed made only of the kit.
 * ?lang=fr (es, pt-BR, de) passes that language's labels to the components.
 */

import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/icon/icon.js';
import '@material/web/menu/menu-item.js';

import de from '../labels/de.json';
import en from '../labels/en.json';
import es from '../labels/es.json';
import fr from '../labels/fr.json';
import ptBR from '../labels/pt-BR.json';
import {addEdgeCaps, formatNumber, formatRelativeTime, initTheme, playDemo} from '../src/index.js';

const LABELS = {en, fr, es, 'pt-BR': ptBR, de};
const lang = new URLSearchParams(location.search).get('lang') as keyof typeof LABELS | null;
const labels = LABELS[lang && lang in LABELS ? lang : 'en'];
document.documentElement.lang = lang && lang in LABELS ? lang : 'en';

initTheme();
addEdgeCaps();

document.querySelector('moddy-app-bar')!.labels = labels.appBar;
document.querySelector('moddy-theme-menu')!.labels = labels.theme;

const userMenu = document.querySelector('moddy-user-menu')!;
userMenu.labels = labels.userMenu;
userMenu.user = {
  handle: 'mia',
  name: 'Mia Laurent',
  email: 'mia@example.com',
  avatar: '/assets/avatars/mia.webp',
  verified: 'Verified account',
  max: true,
};
userMenu.addEventListener('sign-out', () => console.info('sign-out'));

for (const el of document.querySelectorAll<HTMLElement>('[data-number]')) {
  el.textContent = formatNumber(Number(el.dataset.number));
}
for (const el of document.querySelectorAll<HTMLElement>('[data-time]')) {
  el.textContent = formatRelativeTime(Date.now() + Number(el.dataset.time));
}

const conversation = document.querySelector<HTMLElement>('[data-demo="message"]');
if (conversation) {
  playDemo(conversation, [
    [1, 1400],
    [2, 2600],
  ]);
}
