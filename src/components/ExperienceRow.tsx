/**
 * One experience of a profile: the server's icon (or a shape for a service),
 * "Poste, Nom", its dates and duration, an optional description (collapsed
 * when long) and the verification pill. `actions` is a slot for the owner's
 * buttons; `href` makes the title a link to the server's profile.
 * Goes in `<Rows as="ul">`.
 */

import {type ReactNode, useState} from 'react';
import {Link} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import type {ProfileExperience} from '@/api/types';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Row} from '@/ui';

import {formatDuration, formatRange, monthsBetween} from './experienceFormat';
import {GuildIcon} from './GuildIcon';
import {useNow} from './useNow';
import {VerificationPill} from './VerificationPill';

interface ExperienceRowProps {
  experience: ProfileExperience;
  /** Where the title goes (the server's profile); only for a server experience. */
  href?: string;
  /** The server's icon, when its profile was loaded (the experience itself carries none). */
  iconUrl?: string | null;
  /** Buttons for the owner, under the experience. */
  actions?: ReactNode;
  className?: string;
}

/** Longer than this, a description is collapsed to three lines. */
const LONG_DESCRIPTION = 180;

export function ExperienceRow({experience, href, iconUrl, actions, className}: ExperienceRowProps) {
  const {t} = useT('components');
  const {label} = useCatalogLabel();
  useLanguage();
  useNow();
  const [expanded, setExpanded] = useState(false);

  const position =
    experience.position === 'other' && experience.position_other
      ? experience.position_other
      : label('positions', experience.position);
  const title = t('experience.title', {position, name: experience.name});
  const months = monthsBetween(experience.start_date, experience.end_date);
  const meta = `${formatRange(experience.start_date, experience.end_date, t)} · ${formatDuration(months, t)}`;
  const description = experience.description?.trim() || null;
  const collapsible = description !== null && description.length > LONG_DESCRIPTION;

  return (
    <Row className={cx('experience-row', className)}>
      <div className="experience-main">
        {experience.kind === 'guild' && experience.guild_id ? (
          <GuildIcon id={experience.guild_id} iconUrl={iconUrl} />
        ) : (
          <GuildIcon id={experience.id} icon="apartment" />
        )}
        <div className="row-body">
          <span className="row-title">
            {href && experience.kind === 'guild' ? <Link to={href}>{title}</Link> : title}
          </span>
          <span className="row-meta">{meta}</span>
          {description && (
            <>
              <p className={cx('experience-description', collapsible && !expanded && 'is-clamped')}>{description}</p>
              {collapsible && (
                <md-text-button
                  className="experience-toggle"
                  aria-expanded={expanded}
                  onclick={() => setExpanded((value) => !value)}
                >
                  {expanded ? t('experience.showLess') : t('experience.showMore')}
                </md-text-button>
              )}
            </>
          )}
        </div>
        <VerificationPill verification={experience.verification} />
      </div>
      {actions && <div className="experience-actions">{actions}</div>}
    </Row>
  );
}
