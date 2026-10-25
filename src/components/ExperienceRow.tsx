/**
 * One experience as an inner card: the server's icon, the bot's avatar or the
 * service's image (a shape without either), the name in 600 (with its
 * verification mark when the server or bot has a listed profile:
 * `experience.guild`, `experience.bot`, the bot's name then links to it), the
 * position under it, the member count of a server or the server count of a
 * bot, the period and its
 * duration, a short description and the verification. `actions` is a slot under the text
 * for the owner's controls; `href` makes the name a link to the server.
 *
 * Goes in an `ExperienceList` (or any `ul`; `as="div"` elsewhere). Pending, refused and not verified
 * only show in the private views (oneself, the staff).
 */

import {type ReactNode, useState} from 'react';
import {Link} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {paths} from '@/app/paths';
import {isPrivateExperience, type ProfileExperience} from '@/api/types';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';

import {BotAvatar} from './BotAvatar';
import {DisplayName} from './DisplayName';
import {formatDuration, formatRange, monthsBetween} from './experienceFormat';
import {GuildIcon} from './GuildIcon';
import {InlineStats} from './InlineStats';
import {ServiceImage} from './ServiceImage';
import {useNow} from './useNow';
import {VerificationPill} from './VerificationPill';

interface ExperienceRowProps {
  experience: ProfileExperience;
  /** Where the name goes (the server's profile); only for a server experience. */
  href?: string;
  /** Show every verification state, not only a verification. Default: the private views. */
  showStatus?: boolean;
  /** The owner's controls, under the text. */
  actions?: ReactNode;
  /** `li` (default): an inner card, in an `ExperienceList`. `div`: no card, when the row sits inside another card (the sortable list). */
  as?: 'li' | 'div';
  className?: string;
}

/** Longer than this, a description is collapsed to three lines. */
const LONG_DESCRIPTION = 180;

/** The inner cards of a profile or of the staff queue. */
export function ExperienceList({children, ...props}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul {...props} className={cx('inner-cards', props.className)}>
      {children}
    </ul>
  );
}

export function ExperienceRow({experience, href, showStatus, actions, as: Tag = 'li', className}: ExperienceRowProps) {
  const {t} = useT('components');
  const {label} = useCatalogLabel();
  useLanguage();
  useNow();
  const [expanded, setExpanded] = useState(false);
  const isGuild = experience.kind === 'guild' && experience.guild_id !== null;
  const botId = experience.kind === 'bot' ? (experience.bot_id ?? null) : null;
  const guild = experience.guild;
  const bot = experience.bot ?? null;
  // A NSFW server keeps its placeholder, as everywhere else.
  const adult = guild?.badges.some((badge) => badge.id === 'nsfw') ?? false;
  const image = adult
    ? null
    : isGuild
      ? (guild?.icon_url ?? experience.image_url)
      : botId
        ? (bot?.avatar_url ?? experience.image_url)
        : experience.image_url;
  const displayName = isGuild ? (guild?.name ?? experience.name) : (bot?.name ?? experience.name);

  const position =
    experience.position === 'other' && experience.position_other
      ? experience.position_other
      : label('positions', experience.position);
  // A bot counts servers, not members.
  const memberStats = botId
    ? [
        {
          icon: 'dns',
          value: experience.guild_count ?? null,
          label: t('experience.servers', {count: experience.guild_count ?? 0}),
        },
      ]
    : [
        {
          icon: 'group',
          value: experience.member_count,
          label: t('experience.members', {count: experience.member_count ?? 0}),
        },
      ];
  const months = monthsBetween(experience.start_date, experience.end_date);
  const period = formatRange(experience.start_date, experience.end_date, t);
  const duration = formatDuration(months, t);
  const description = experience.description?.trim() || null;
  const collapsible = description !== null && description.length > LONG_DESCRIPTION;
  // A bot links to its Lineup profile when it has a listed one (`experience.bot`), else name and picture alone.
  const name =
    href && isGuild ? (
      <Link to={href}>{displayName}</Link>
    ) : botId && bot ? (
      <Link to={paths.bot(botId)}>{displayName}</Link>
    ) : (
      displayName
    );

  return (
    <Tag className={cx('experience-row', Tag === 'li' && 'inner-card', className)}>
      <div className="experience-marker">
        {isGuild && experience.guild_id ? (
          <GuildIcon id={experience.guild_id} iconUrl={image} noReferrer />
        ) : botId ? (
          <BotAvatar id={botId} src={image} />
        ) : (
          <ServiceImage url={image} />
        )}
      </div>
      <div className="experience-body">
        <div className="experience-head">
          <p className="experience-name">
            {isGuild ? (
              <DisplayName name={name} badges={guild?.badges} entity="guild" />
            ) : botId ? (
              <DisplayName name={name} badges={bot?.badges} entity="bot" />
            ) : (
              name
            )}
          </p>
          <VerificationPill
            verification={experience.verification}
            showAll={showStatus ?? isPrivateExperience(experience)}
          />
        </div>
        <p className="experience-position">{position}</p>
        {(isGuild || botId) && <InlineStats compact items={memberStats} />}
        <p className="experience-period numeric">
          {period} · {duration}
        </p>
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
        {actions && <div className="experience-actions">{actions}</div>}
      </div>
    </Tag>
  );
}
