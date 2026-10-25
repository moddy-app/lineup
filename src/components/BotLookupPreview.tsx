/**
 * The preview of a bot found by its Application ID (`GET /lineup/bots/lookup`):
 * picture, name, Discord's verification, server count and support server. In
 * the claim dialog and the experience dialog.
 */

import type {BotLookup} from '@/api/types';
import {useT} from '@/i18n/useT';
import {Icon, InnerCard} from '@/ui';

import {BotAvatar} from './BotAvatar';
import {GuildIcon} from './GuildIcon';
import {InlineStats} from './InlineStats';

export function BotLookupPreview({bot}: {bot: BotLookup}) {
  const {t} = useT('components');
  const support = bot.support_guild;
  return (
    <InnerCard className="bot-preview">
      <BotAvatar id={bot.id} src={bot.avatar_url} size="large" />
      <div className="bot-preview-body">
        <strong className="bot-preview-name">{bot.name ?? t('bot.unknownName')}</strong>
        {bot.is_verified && (
          <span className="bot-preview-verified">
            <Icon name="verified" filled />
            {t('bot.verifiedApp')}
          </span>
        )}
        <InlineStats
          compact
          items={[{icon: 'dns', value: bot.guild_count, label: t('bot.servers', {count: bot.guild_count ?? 0})}]}
        />
        {support && (
          <span className="bot-preview-support">
            <GuildIcon id={support.id} iconUrl={support.icon_url} size="small" />
            <span>{t('bot.supportGuild', {name: support.name ?? support.id})}</span>
          </span>
        )}
      </div>
    </InnerCard>
  );
}
