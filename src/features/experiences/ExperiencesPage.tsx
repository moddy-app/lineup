/**
 * My experiences (LINEUP.md §6.6, §7). The list in my order (drag and drop,
 * keyboard, or the move buttons), a dialog to add or edit, deletion with a
 * confirmation and, on each one, its verification.
 */

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {useQueryClient} from '@tanstack/react-query';
import {useMemo, useState} from 'react';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useDeleteExperience, useReorderExperiences} from '@/api/mutations';
import {useCatalog, useMyExperiences} from '@/api/queries';
import {queryKeys} from '@/api/queryKeys';
import type {PrivateExperience} from '@/api/types';
import {usePageTitle} from '@/app/usePageTitle';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {EmptyState, ErrorState} from '@/components';
import {useT} from '@/i18n/useT';
import {formatNumber} from '@/lib/format';
import {getItem, removeItem} from '@/lib/storage';
import {Card, ConfirmDialog, PageLoading, SettingsLayout, Shape, useSnackbar} from '@/ui';

import {ExperienceDialog, EXPERIENCE_DRAFT_KEY} from './ExperienceDialog';
import {ExperienceItem} from './ExperienceItem';
import type {ExperienceFormState} from './experienceForm';
import {move} from './experienceForm';
import './experiences.css';

/** The dialog: a new experience, or the one with this id. `draft` restores a form saved before a sign-in. */
type DialogState = {id: string | null; draft?: ExperienceFormState | null} | null;

const FALLBACK_MAX = 50;

export function Component() {
  const {t} = useT('experiences');
  const {t: tErrors} = useT('errors');
  const {t: tCommon} = useT('common');
  usePageTitle(t('title'));
  const {label} = useCatalogLabel();
  const catalog = useCatalog().data;
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();
  const query = useMyExperiences();
  const reorder = useReorderExperiences();
  const remove = useDeleteExperience();

  const [dialog, setDialog] = useState<DialogState>(() => {
    const saved = getItem<{id: string | null; form: ExperienceFormState} | null>(EXPERIENCE_DRAFT_KEY, null, 'session');
    removeItem(EXPERIENCE_DRAFT_KEY, 'session');
    return saved ? {id: saved.id, draft: saved.form} : null;
  });
  const [toDelete, setToDelete] = useState<PrivateExperience | null>(null);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  /** The order while a save is under way, so that the list does not jump back. */
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);

  const server = query.data?.items;
  const items = useMemo(() => {
    if (!server) return [];
    if (!pendingOrder) return server;
    const byId = new Map(server.map((item) => [item.id, item]));
    const ordered = pendingOrder.flatMap((id) => byId.get(id) ?? []);
    return ordered.length === server.length ? ordered : server;
  }, [server, pendingOrder]);
  const max = catalog?.limits.max_experiences ?? FALLBACK_MAX;

  const titleOf = (experience: PrivateExperience) =>
    t('list.title', {
      position:
        experience.position === 'other' && experience.position_other
          ? experience.position_other
          : label('positions', experience.position),
      name: experience.name,
    });

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 6}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  );

  async function commit(ids: string[]) {
    setPendingOrder(ids);
    try {
      const saved = await auth.run(() => reorder.mutateAsync(ids));
      if (saved) snackbar.show({message: t('list.reordered')});
    } catch (error) {
      if (hasCode(error, 'lineup_experience_order_invalid')) {
        await queryClient.invalidateQueries({queryKey: queryKeys.myExperiences()});
        snackbar.show({message: t('list.orderOutdated')});
      } else {
        snackbar.show({message: errorMessage(error, tErrors)});
      }
    } finally {
      setPendingOrder(null);
    }
  }

  function moveItem(from: number, to: number) {
    if (reorder.isPending) return;
    const ids = items.map((item) => item.id);
    const next = move(ids, from, to);
    void commit(next);
    const moved = items[from];
    if (moved) snackbar.show({message: t('list.moved', {title: titleOf(moved), position: to + 1, total: ids.length})});
  }

  function onDragEnd({active, over}: DragEndEvent) {
    if (!over || active.id === over.id || reorder.isPending) return;
    const ids = items.map((item) => item.id);
    void commit(move(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  const nameOf = (id: string | number) => {
    const experience = items.find((item) => item.id === id);
    return experience ? titleOf(experience) : String(id);
  };

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleteError(null);
    try {
      const done = await auth.run(async () => {
        await remove.mutateAsync(toDelete.id);
        return true;
      });
      if (done) {
        snackbar.show({message: t('delete.done')});
        setToDelete(null);
      }
    } catch (error) {
      if (hasCode(error, 'lineup_experience_not_found')) {
        await queryClient.invalidateQueries({queryKey: queryKeys.myExperiences()});
        setToDelete(null);
        return;
      }
      setDeleteError(error);
    }
  }

  if (query.isPending) return <PageLoading />;
  if (query.isError) {
    return (
      <SettingsLayout title={t('title')}>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </SettingsLayout>
    );
  }

  const full = items.length >= max;
  const editing = dialog?.id ? (items.find((item) => item.id === dialog.id) ?? null) : null;
  const add = (
    <md-filled-button type="button" disabled={!canWrite || full} onclick={() => setDialog({id: null})}>
      <md-icon slot="icon" className="filled" aria-hidden="true">
        add
      </md-icon>
      {t('list.add')}
    </md-filled-button>
  );

  return (
    <SettingsLayout title={t('title')} description={t('list.intro')} actions={add}>
      <div className="exp-summary">
        <p className="exp-count numeric">
          {t('aside.count', {used: formatNumber(items.length), max: formatNumber(max)})}
        </p>
        <md-linear-progress value={Math.min(items.length, max)} max={max} aria-hidden="true" />
        {full && <p className="exp-error">{t('dialog.limit', {count: items.length, max})}</p>}
      </div>
      {items.length === 0 ? (
        <EmptyState compact icon="work_history" title={t('empty.title')}>
          {t('empty.body')}
        </EmptyState>
      ) : (
        <Card className="exp-card">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{
              screenReaderInstructions: {draggable: t('dnd.instructions')},
              announcements: {
                onDragStart: ({active}) => t('dnd.start', {title: nameOf(active.id)}),
                onDragOver: ({active, over}) =>
                  over
                    ? t('dnd.over', {
                        title: nameOf(active.id),
                        position: items.findIndex((item) => item.id === over.id) + 1,
                        total: items.length,
                      })
                    : undefined,
                onDragEnd: ({active, over}) =>
                  over
                    ? t('dnd.end', {
                        title: nameOf(active.id),
                        position: items.findIndex((item) => item.id === over.id) + 1,
                        total: items.length,
                      })
                    : t('dnd.cancel', {title: nameOf(active.id)}),
                onDragCancel: ({active}) => t('dnd.cancel', {title: nameOf(active.id)}),
              },
            }}
          >
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className="exp-list" aria-label={t('title')}>
                {items.map((experience, index) => (
                  <ExperienceItem
                    key={experience.id}
                    experience={experience}
                    index={index}
                    total={items.length}
                    title={titleOf(experience)}
                    disabled={!canWrite || reorder.isPending}
                    onMove={moveItem}
                    onEdit={(item) => setDialog({id: item.id})}
                    onDelete={(item) => {
                      setDeleteError(null);
                      setToDelete(item);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </Card>
      )}

      <details className="exp-rules">
        <summary>{t('aside.verifyTitle')}</summary>
        <ul>
          <li>
            <Shape shape="hexagon" tone="tertiary" icon="verified_user" small />
            <span>{t('aside.auto')}</span>
          </li>
          <li>
            <Shape shape="diamond" tone="secondary" icon="rate_review" small />
            <span>{t('aside.manual')}</span>
          </li>
          <li>
            <Shape shape="pentagon" icon="edit_note" small />
            <span>{t('aside.reset')}</span>
          </li>
        </ul>
      </details>

      {dialog && (dialog.id === null || editing) && (
        <ExperienceDialog
          key={dialog.id ?? 'new'}
          experience={editing}
          draft={dialog.draft}
          count={items.length}
          max={max}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        destructive
        busy={remove.isPending}
        title={t('delete.title', {title: toDelete ? titleOf(toDelete) : ''})}
        confirmLabel={tCommon('actions.delete')}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
        body={
          <>
            <p>{t('delete.body')}</p>
            <p>{t('delete.featured')}</p>
            {deleteError != null && (
              <p className="exp-error" role="alert">
                {errorMessage(deleteError, tErrors)}
              </p>
            )}
          </>
        }
      />
    </SettingsLayout>
  );
}
