import {useMyBots} from '@/api/queries';
import {paths} from '@/app/paths';
import {BotAvatar, EmptyState, ErrorState} from '@/components';
import {useT} from '@/i18n/useT';
import {Dialog, Icon, LinkButton, Spinner} from '@/ui';

import './claim.css';

/** md-dialog focuses the element marked `autofocus` (not the first button of the content). */
const AUTOFOCUS: object = {autofocus: true};

/**
 * "Manage bots": the bots whose support server the person owns or
 * administers (`GET /lineup/me/bots`), listed or not. `stale` means Discord did
 * not answer: that is "could not check", never "no bot".
 */
export function ManageBotsDialog({open, onClose, onAdd}: {open: boolean; onClose: () => void; onAdd: () => void}) {
  const {t} = useT('bots');
  const bots = useMyBots();
  const items = bots.data?.items ?? [];

  const body =
    bots.isPending && bots.fetchStatus !== 'idle' ? (
      <Spinner />
    ) : bots.isError ? (
      <ErrorState compact error={bots.error} onRetry={() => void bots.refetch()} retrying={bots.isFetching} />
    ) : bots.data?.stale ? (
      <EmptyState
        compact
        icon="cloud_off"
        title={t('mine.staleTitle')}
        action={
          <md-outlined-button disabled={bots.isFetching} onclick={() => void bots.refetch()}>
            {t('mine.retry')}
          </md-outlined-button>
        }
      >
        {t('mine.staleBody')}
      </EmptyState>
    ) : items.length === 0 ? (
      <EmptyState
        compact
        icon="smart_toy"
        title={t('mine.emptyTitle')}
        action={<md-outlined-button onclick={onAdd}>{t('mine.add')}</md-outlined-button>}
      >
        {t('mine.emptyBody')}
      </EmptyState>
    ) : (
      <>
        <ul className="servers-list" aria-label={t('mine.label')}>
          {items.map((bot) => (
            <li key={bot.id} className="servers-item inner-card">
              <BotAvatar id={bot.id} src={bot.avatar_url} />
              <div className="servers-item-body">
                <strong className="servers-item-name">{bot.name ?? t('unknownName')}</strong>
                <span className="servers-item-meta">
                  <Icon name={bot.listed ? 'visibility' : 'visibility_off'} filled />
                  {bot.listed ? t('mine.listed') : t('mine.unlisted')}
                </span>
              </div>
              <div className="servers-item-actions">
                <LinkButton to={paths.bot(bot.id)} variant="text">
                  {t('mine.profile')}
                </LinkButton>
                <LinkButton to={paths.botManage(bot.id)} variant="outlined">
                  {t('mine.manage')}
                </LinkButton>
              </div>
            </li>
          ))}
        </ul>
        <div className="servers-foot">
          <md-text-button onclick={onAdd}>{t('mine.add')}</md-text-button>
        </div>
      </>
    );

  return (
    <Dialog
      className="servers-dialog"
      open={open}
      onClose={onClose}
      headline={t('mine.title')}
      actions={
        <md-text-button {...AUTOFOCUS} onclick={onClose}>
          {t('claim.close')}
        </md-text-button>
      }
    >
      <div className="servers-form">{body}</div>
    </Dialog>
  );
}
