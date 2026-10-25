/**
 * A bot, from its card (`BotCard`: the directory, "my bots", a server's bots).
 *
 *  - `BotTile`: a whole-card link for the directory grid (`.bot-grid`): avatar,
 *    name with its mark, server count, two lines of description, tags.
 *  - `BotRow`: an inner card link for lists inside a card (a server profile,
 *    dialogs); `unlisted` adds the "not listed" status.
 */

import type {BotCard} from '@/api/types';
import {paths} from '@/app/paths';
import {useT} from '@/i18n/useT';
import {Card, InnerCard, Status} from '@/ui';

import {BotAvatar} from './BotAvatar';
import {DisplayName} from './DisplayName';
import {InlineStats} from './InlineStats';
import {TagLabel} from './TagLabel';

export function BotTile({bot}: {bot: BotCard}) {
  const {t} = useT('components');
  const name = bot.name ?? t('bot.unknownName');
  return (
    <Card to={paths.bot(bot.id)} className="bot-tile">
      <div className="bot-tile-head">
        <BotAvatar id={bot.id} src={bot.avatar_url} size="large" />
        <div className="bot-tile-text">
          <DisplayName
            as="h3"
            className="bot-tile-name"
            name={name}
            badges={bot.badges}
            entity="bot"
            focusable={false}
          />
          <InlineStats
            compact
            items={[{icon: 'dns', value: bot.guild_count, label: t('bot.servers', {count: bot.guild_count ?? 0})}]}
          />
        </div>
      </div>
      {bot.description && <p className="bot-tile-description">{bot.description}</p>}
      {bot.tags.length > 0 && (
        <ul className="tag-labels bot-tile-tags" aria-label={t('bot.tags')}>
          {bot.tags.slice(0, 3).map((tag) => (
            <li key={tag}>
              <TagLabel icon={null}>{tag}</TagLabel>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function BotRow({bot, unlisted}: {bot: BotCard; unlisted?: boolean}) {
  const {t} = useT('components');
  const name = bot.name ?? t('bot.unknownName');
  return (
    <InnerCard as="li" to={paths.bot(bot.id)} className="bot-row">
      <BotAvatar id={bot.id} src={bot.avatar_url} />
      <span className="bot-row-body">
        <DisplayName className="bot-row-name" name={name} badges={bot.badges} entity="bot" focusable={false} />
        <InlineStats
          compact
          items={[{icon: 'dns', value: bot.guild_count, label: t('bot.servers', {count: bot.guild_count ?? 0})}]}
        />
      </span>
      {unlisted && !bot.listed && <Status className="neutral">{t('bot.unlisted')}</Status>}
    </InnerCard>
  );
}
