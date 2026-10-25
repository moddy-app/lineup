import {useCatalogLabel} from '@/api/catalog';
import type {TeamMember} from '@/api/types';
import {paths} from '@/app/paths';
import {DisplayName, UserAvatar} from '@/components';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatMonthYear} from '@/lib/format';
import {Card, InnerCard, InnerCards} from '@/ui';

interface TeamCardProps {
  team: TeamMember[];
  title: string;
  /** Names the list. */
  label: string;
  /** Said when nobody is in the team yet. */
  empty: string;
}

/** The team of a server or a bot: people with a verified, current experience, each a link to their profile. */
export function TeamCard({team, title, label: listLabel, empty}: TeamCardProps) {
  const {t} = useT('guildProfile');
  const {label} = useCatalogLabel();
  useLanguage();
  return (
    <Card as="section" className="guild-team" aria-labelledby="guild-team-title">
      <h2 id="guild-team-title">{title}</h2>
      {team.length === 0 ? (
        <p className="guild-empty">{empty}</p>
      ) : (
        <InnerCards aria-label={listLabel}>
          {team.map((member) => {
            const position =
              member.position === 'other' && member.position_other
                ? member.position_other
                : label('positions', member.position);
            const display = member.user.display_name ?? member.user.username ?? member.user.id;
            return (
              <InnerCard as="li" key={member.user.id} to={paths.user(member.user.id)}>
                <UserAvatar
                  id={member.user.id}
                  src={member.user.avatar_url}
                  decoration={member.user.avatar_decoration}
                  size="small"
                />
                <span className="guild-member">
                  <DisplayName
                    name={display}
                    badges={member.user.badges}
                    entity="user"
                    className="guild-member-name"
                    focusable={false}
                  />
                  <span className="guild-member-meta">
                    {t('team.since', {position, date: formatMonthYear(member.since)})}
                  </span>
                </span>
              </InnerCard>
            );
          })}
        </InnerCards>
      )}
    </Card>
  );
}
