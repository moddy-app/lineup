import {hasCode} from '@/api/client';
import {useMyGuilds} from '@/api/queries';
import {paths} from '@/app/paths';
import {useReauthenticate} from '@/auth/reauth';
import {EmptyState, ErrorState, GuildIcon} from '@/components';
import {useT} from '@/i18n/useT';
import {Dialog, Icon, LinkButton, Spinner} from '@/ui';

import './claim.css';

/** md-dialog focuses the element marked `autofocus` (not the first button of the content). */
const AUTOFOCUS: object = {autofocus: true};

/**
 * "Manage servers": the servers already on Lineup, each with its profile and
 * its management page. Following a link leaves the page, which closes the
 * dialog (its address parameter goes with the old address).
 */
export function ManageServersDialog({open, onClose, onAdd}: {open: boolean; onClose: () => void; onAdd: () => void}) {
  const {t} = useT('claim');
  const reauth = useReauthenticate();
  const guilds = useMyGuilds();
  const claimed = (guilds.data ?? []).filter((guild) => guild.claimed);

  const body =
    guilds.isPending && guilds.fetchStatus !== 'idle' ? (
      <Spinner />
    ) : guilds.isError ? (
      hasCode(guilds.error, 'lineup_reauth_required') ? (
        <EmptyState
          compact
          icon="lock_reset"
          title={t('list.reauthTitle')}
          action={
            <md-outlined-button onclick={() => reauth(guilds.error)}>{t('list.reauthAction')}</md-outlined-button>
          }
        >
          {t('list.reauthBody')}
        </EmptyState>
      ) : (
        <ErrorState compact error={guilds.error} onRetry={() => void guilds.refetch()} retrying={guilds.isFetching} />
      )
    ) : claimed.length === 0 ? (
      <EmptyState
        compact
        icon="groups"
        title={t('onLineup.emptyTitle')}
        action={<md-outlined-button onclick={onAdd}>{t('menu.add')}</md-outlined-button>}
      >
        {t('onLineup.emptyBody')}
      </EmptyState>
    ) : (
      <>
        <ul className="servers-list" aria-label={t('onLineup.label')}>
          {claimed.map((guild) => (
            <li key={guild.id} className="servers-item inner-card">
              <GuildIcon id={guild.id} iconUrl={guild.icon_url} />
              <div className="servers-item-body">
                <strong className="servers-item-name">{guild.name ?? t('unknownName')}</strong>
                <span className="servers-item-meta">
                  <Icon name={guild.listed ? 'visibility' : 'visibility_off'} filled />
                  {guild.listed ? t('onLineup.listed') : t('onLineup.unlisted')}
                </span>
              </div>
              <div className="servers-item-actions">
                <LinkButton to={paths.guild(guild.id)} variant="text">
                  {t('onLineup.profile')}
                </LinkButton>
                <LinkButton to={paths.guildManage(guild.id)} variant="outlined">
                  {t('onLineup.manage')}
                </LinkButton>
              </div>
            </li>
          ))}
        </ul>
        <div className="servers-foot">
          <md-text-button onclick={onAdd}>{t('menu.add')}</md-text-button>
        </div>
      </>
    );

  return (
    <Dialog
      className="servers-dialog"
      open={open}
      onClose={onClose}
      headline={t('menu.manage')}
      actions={
        <md-text-button {...AUTOFOCUS} onclick={onClose}>
          {t('dialog.close')}
        </md-text-button>
      }
    >
      <div className="servers-form">{body}</div>
    </Dialog>
  );
}
