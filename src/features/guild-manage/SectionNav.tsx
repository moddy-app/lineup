import {useT} from '@/i18n/useT';

import {SECTION_IDS} from './sectionIds';

const ORDER = ['profile', 'invite', 'visibility', 'posts', 'discord', 'danger'] as const;

/** Jumps to a panel. Smooth only when motion is welcome. */
function jump(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  const calm = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  target.scrollIntoView({block: 'start', behavior: calm ? 'smooth' : 'auto'});
}

/** The sections of the page, as links to its panels. */
export function SectionNav() {
  const {t} = useT('guildManage');
  return (
    <nav className="manage-sections" aria-label={t('sections.label')}>
      <ul>
        {ORDER.map((key) => (
          <li key={key}>
            <a href={`#${SECTION_IDS[key]}`} onClick={(event) => jump(event, SECTION_IDS[key])}>
              {t(`sections.${key}`)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
