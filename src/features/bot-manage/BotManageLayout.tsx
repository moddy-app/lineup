import {Outlet, useLocation, useParams} from 'react-router';

import {hasCode} from '@/api/client';
import {useBot} from '@/api/queries';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {EmptyState, ErrorState} from '@/components';
import {useT} from '@/i18n/useT';
import {Icon, LinkButton, PageLoading, SettingsLayout} from '@/ui';

import '../guild-manage/guildManage.css';

type Section = 'profile' | 'posts' | 'discord' | 'settings';

function sectionOf(pathname: string, botId: string): Section {
  const at = (path: string) => pathname.replace(/\/$/, '') === path;
  if (at(paths.botManagePosts(botId))) return 'posts';
  if (at(paths.botManageDiscord(botId))) return 'discord';
  if (at(paths.botManageSettings(botId))) return 'settings';
  return 'profile';
}

/**
 * Parent of the management pages of a bot, like a server's: reads the bot
 * once, handles loading, not found and refused access (`can_manage` only
 * shows the buttons; the API checks every write), then the dashboard layout
 * around the page (`<Outlet context={bot}>`). A bot that is no longer
 * discoverable gets a notice on every page.
 */
export function Component() {
  const {botId} = useParams();
  const {pathname} = useLocation();
  const {t} = useT('botManage');
  const {t: tNav} = useT('components');
  const query = useBot(botId);
  const bot = query.data;
  usePageTitle(bot?.name ? t('pageTitle', {name: bot.name}) : t('title'));

  if (query.isPending) return <PageLoading />;

  if (query.isError || !bot) {
    return (
      <SettingsLayout title={t('title')}>
        {hasCode(query.error, 'lineup_bot_not_found') ? (
          <EmptyState
            icon="search_off"
            shape="octagon"
            tone="tertiary"
            title={t('notFound.title')}
            action={
              <LinkButton to={paths.bots()} icon="smart_toy">
                {t('notFound.action')}
              </LinkButton>
            }
          >
            {t('notFound.body')}
          </EmptyState>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        )}
      </SettingsLayout>
    );
  }

  if (!bot.can_manage) {
    return (
      <SettingsLayout title={t('title')}>
        <EmptyState
          icon="lock"
          shape="pentagon"
          tone="tertiary"
          title={t('forbidden.title')}
          action={
            <LinkButton to={paths.bot(bot.id)} icon="smart_toy">
              {t('forbidden.action')}
            </LinkButton>
          }
        >
          {t('forbidden.body')}
        </EmptyState>
      </SettingsLayout>
    );
  }

  const section = sectionOf(pathname, bot.id);
  return (
    <SettingsLayout
      className="manage-page"
      title={tNav(`settings.botNav.${section}`)}
      description={t(`pages.${section}`)}
      actions={
        section === 'profile' ? (
          <LinkButton to={paths.bot(bot.id)} variant="outlined" icon="visibility">
            {t('viewProfile')}
          </LinkButton>
        ) : section === 'posts' ? (
          <LinkButton to={paths.postNew({botId: bot.id})} icon="add">
            {t('newPost')}
          </LinkButton>
        ) : undefined
      }
    >
      {!bot.discoverable && (
        <p className="manage-notice" role="status">
          <Icon name="travel_explore" filled />
          <span>{t('notDiscoverable')}</span>
        </p>
      )}
      <Outlet key={bot.id} context={bot} />
    </SettingsLayout>
  );
}
