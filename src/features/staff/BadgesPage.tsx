import {useEffect, useMemo, useState} from 'react';
import {useSearchParams} from 'react-router';
import {useQueryClient} from '@tanstack/react-query';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useGrantBadge, useRevokeBadge} from '@/api/mutations';
import {type InfiniteList, useInfiniteList} from '@/api/pagination';
import {useCatalog, useStaffBadges} from '@/api/queries';
import {queryKeys} from '@/api/queryKeys';
import type {BadgeEntityType, ManualBadgeGrant, StaffBadgesPage} from '@/api/types';
import {usePageTitle} from '@/app/usePageTitle';
import {useSession} from '@/auth/session';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useAuthAction} from '@/auth/useAuthAction';
import {badgeIcon} from '@/components/badgeIcons';
import {RelativeTime} from '@/components';
import {useT} from '@/i18n/useT';
import {getItem, removeItem, setItem} from '@/lib/storage';
import {Card, Icon, Pill, SettingsPanel, Select, TextField, useSnackbar} from '@/ui';

import {ActionDialog, EntityName, ListBody, PersonLink, SectionHead, StatusChips} from './parts';
import {BADGE_NOTE_MAX, ENTITY_FILTERS, isEntityId, manualBadgesFor, parseEntityFilter} from './staffLogic';

const DRAFT_KEY = 'lineup-staff-grant';
const byNewest = (a: ManualBadgeGrant, b: ManualBadgeGrant) => +new Date(b.granted_at) - +new Date(a.granted_at);

/** The grants of one entity type, or of both merged (newest first) when the filter is "all". */
function mergeLists(lists: Array<InfiniteList<ManualBadgeGrant>>): InfiniteList<ManualBadgeGrant> {
  if (lists.length === 1) return lists[0]!;
  const failed = lists.find((list) => list.isError);
  const moreFailed = lists.find((list) => list.isLoadMoreError);
  return {
    items: lists.flatMap((list) => list.items).sort(byNewest),
    hasMore: lists.some((list) => list.hasMore),
    loadMore: () => lists.forEach((list) => list.hasMore && list.loadMore()),
    isLoadingMore: lists.some((list) => list.isLoadingMore),
    isLoading: lists.some((list) => list.isLoading),
    isRefetching: lists.some((list) => list.isRefetching),
    isPlaceholderData: false,
    isEmpty: lists.every((list) => list.isEmpty),
    isError: !!failed,
    isLoadMoreError: !!moreFailed,
    error: (failed ?? moreFailed ?? lists[0]!).error,
    refetch: () => lists.forEach((list) => list.isError && list.refetch()),
  };
}

export function Component() {
  const {t} = useT('staff');
  usePageTitle(`${t('nav.badges')} · ${t('title')}`);
  const [params, setParams] = useSearchParams();
  const filter = parseEntityFilter(params.get('entity'));
  const users = useInfiniteList<ManualBadgeGrant, StaffBadgesPage>(useStaffBadges('user'));
  const guilds = useInfiniteList<ManualBadgeGrant, StaffBadgesPage>(useStaffBadges('guild'));
  const list = mergeLists(filter === 'all' ? [users, guilds] : filter === 'user' ? [users] : [guilds]);
  const revoke = useRevokeBadge();
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<ManualBadgeGrant | null>(null);

  return (
    <>
      <GrantForm />
      <section className="staff-section">
        <SectionHead title={t('badges.listTitle')}>
          <StatusChips
            label={t('badges.filter')}
            value={filter}
            onChange={(value) => {
              const next = new URLSearchParams(params);
              if (value === 'all') next.delete('entity');
              else next.set('entity', value);
              setParams(next, {replace: true});
            }}
            options={ENTITY_FILTERS.map((value) => ({value, label: t(`badges.filters.${value}`)}))}
          />
        </SectionHead>
        <Card className="staff-card">
          <ListBody
            list={list}
            emptyIcon="verified"
            emptyTitle={t('badges.empty.title')}
            emptyText={t('badges.empty.text')}
          >
            <ul className="staff-items">
              {list.items.map((grant) => (
                <GrantItem
                  key={`${grant.entity_type}:${grant.entity_id}:${grant.badge}`}
                  grant={grant}
                  onRevoke={() => setRevoking(grant)}
                />
              ))}
            </ul>
          </ListBody>
        </Card>
      </section>

      <ActionDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        headline={t('badges.revoke.title')}
        intro={t('badges.revoke.text')}
        confirmLabel={t('badges.revoke.confirm')}
        destructive
        successMessage={t('badges.revoke.done')}
        onSubmit={() =>
          revoke.mutateAsync({entityType: revoking!.entity_type, entityId: revoking!.entity_id, badge: revoking!.badge})
        }
        onFailure={(error) => {
          // Already gone: the list was stale.
          if (hasCode(error, 'lineup_badge_not_found') && revoking) {
            void queryClient.invalidateQueries({queryKey: queryKeys.staffBadges(revoking.entity_type)});
          }
        }}
      />
    </>
  );
}

interface Draft {
  entityType: BadgeEntityType;
  entityId: string;
  badge: string;
  note: string;
}

function GrantForm() {
  const {t} = useT('staff');
  const {t: tErrors} = useT('errors');
  const {label} = useCatalogLabel();
  const {data: catalog} = useCatalog();
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const snackbar = useSnackbar();
  const grant = useGrantBadge();
  const saved = useMemo(() => getItem<Partial<Draft>>(DRAFT_KEY, {}, 'session'), []);
  const [entityType, setEntityType] = useState<BadgeEntityType>(saved.entityType === 'guild' ? 'guild' : 'user');
  const [entityId, setEntityId] = useState(typeof saved.entityId === 'string' ? saved.entityId : '');
  const [badge, setBadge] = useState(typeof saved.badge === 'string' ? saved.badge : '');
  const [note, setNote] = useState(typeof saved.note === 'string' ? saved.note : '');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // A 401 sends the whole page to Discord: keep what was typed.
  useEffect(() => {
    removeItem(DRAFT_KEY, 'session');
    return registerBeforeLogin(() => setItem(DRAFT_KEY, {entityType, entityId, badge, note}, 'session'));
  }, [entityType, entityId, badge, note]);

  // Only the manual badges that exist for this kind of entity; a pick that no longer fits is dropped.
  const options = manualBadgesFor(catalog?.badges, entityType);
  const badgeValue = options.some((option) => option.id === badge) ? badge : '';
  const id = entityId.trim();
  const idError = submitted && !isEntityId(id) ? t('badges.form.idInvalid') : undefined;
  const dropped = badge !== '' && badgeValue === '';
  const badgeError = dropped
    ? t('badges.form.notForEntity')
    : submitted && badgeValue === ''
      ? t('badges.form.badgeRequired')
      : undefined;
  const serverOnly = options.length > 0 && manualBadgesFor(catalog?.badges, 'guild').length > options.length;

  async function submit() {
    setSubmitted(true);
    setError(null);
    if (!isEntityId(id) || badgeValue === '') return;
    try {
      const result = await auth.run(() =>
        grant.mutateAsync({entityType, entityId: id, badge: badgeValue, note: note.trim() || undefined}),
      );
      if (!result) return;
      snackbar.show({message: t('badges.form.done')});
      setEntityId('');
      setNote('');
      setSubmitted(false);
    } catch (failure) {
      setError(failure);
    }
  }

  return (
    <SettingsPanel title={t('badges.form.title')} description={t('badges.form.text')}>
      <form
        className="staff-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="staff-form-row">
          <Select
            label={t('badges.form.entityType')}
            value={entityType}
            onValueChange={(value) => setEntityType(value === 'guild' ? 'guild' : 'user')}
            options={[
              {value: 'user', label: t('badges.entities.user')},
              {value: 'guild', label: t('badges.entities.guild')},
            ]}
          />
          <TextField
            label={t('badges.form.entityId')}
            value={entityId}
            onValueChange={setEntityId}
            inputMode="numeric"
            autocomplete="off"
            required
            maxLength={20}
            supportingText={t('badges.form.entityIdHint')}
            errorText={idError}
          />
          <Select
            label={t('badges.form.badge')}
            value={badgeValue}
            onValueChange={setBadge}
            required
            options={options.map((option) => ({value: option.id, label: label('badges', option.id, option.label)}))}
            supportingText={entityType === 'user' && serverOnly ? t('badges.form.serverOnly') : undefined}
            errorText={badgeError}
          />
        </div>
        <div className="staff-form-row">
          <TextField label={t('badges.form.note')} value={note} onValueChange={setNote} maxLength={BADGE_NOTE_MAX} />
          <md-filled-button type="submit" disabled={grant.isPending || !canWrite}>
            {t('badges.form.submit')}
          </md-filled-button>
        </div>
        {error !== null && (
          <p className="staff-error" role="alert">
            <Icon name="error" filled />
            {errorMessage(error, tErrors)}
          </p>
        )}
      </form>
    </SettingsPanel>
  );
}

function GrantItem({grant, onRevoke}: {grant: ManualBadgeGrant; onRevoke: () => void}) {
  const {t} = useT('staff');
  const {label} = useCatalogLabel();
  const name = label('badges', grant.badge);
  return (
    <li className="staff-item inner-card">
      <div className="staff-item-main">
        <div className="staff-item-head">
          <span className="staff-badge-line">
            <Icon name={badgeIcon(grant.badge)} filled />
            {name}
          </span>
          <span className="staff-item-meta">
            <RelativeTime value={grant.granted_at} />
          </span>
        </div>
        <div className="staff-item-meta">
          <span>{t(`badges.entities.${grant.entity_type}`)}</span>
          <EntityName type={grant.entity_type} id={grant.entity_id} />
          <Pill>{grant.entity_id}</Pill>
        </div>
        {grant.note && <p>{grant.note}</p>}
        <div className="staff-item-meta">
          <span>{t('badges.grantedBy')}</span>
          <PersonLink id={grant.granted_by} />
        </div>
      </div>
      <div className="staff-item-actions">
        <md-outlined-button onclick={onRevoke}>{t('badges.revoke.action')}</md-outlined-button>
      </div>
    </li>
  );
}
