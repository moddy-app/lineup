import {useState} from 'react';
import {useSearchParams} from 'react-router';
import {useQueryClient} from '@tanstack/react-query';

import {hasCode} from '@/api/client';
import {useDismissReport, useResolveReport} from '@/api/mutations';
import {useInfiniteList} from '@/api/pagination';
import {useStaffReports} from '@/api/queries';
import {queryKeys} from '@/api/queryKeys';
import type {Paginated, Report, ReportTargetType} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {RelativeTime} from '@/components';
import {useT} from '@/i18n/useT';
import {formatNumber} from '@/lib/format';
import {
  Bento,
  Card,
  Chip,
  LinkButton,
  Section,
  Select,
  Shape,
  type ShapeName,
  type ShapeTone,
  Stack,
  Status,
} from '@/ui';

import {ActionDialog, ListBody, PersonLink} from './parts';
import {parseReportStatus, REPORT_STATUSES} from './staffLogic';

const TARGET_VIEW: Record<ReportTargetType, {icon: string; shape: ShapeName; tone: ShapeTone}> = {
  post: {icon: 'campaign', shape: 'square', tone: 'primary'},
  user: {icon: 'person', shape: 'diamond', tone: 'tertiary'},
  guild: {icon: 'groups', shape: 'octagon', tone: 'secondary'},
};

function targetPath(report: Report): string {
  switch (report.target_type) {
    case 'post':
      return paths.post(report.target_id);
    case 'user':
      return paths.user(report.target_id);
    case 'guild':
      return paths.guild(report.target_id);
  }
}

type Pending = {kind: 'resolve' | 'dismiss'; report: Report} | null;

export function Component() {
  const {t} = useT('staff');
  usePageTitle(`${t('nav.reports')} · ${t('title')}`);
  const [params, setParams] = useSearchParams();
  const status = parseReportStatus(params.get('status'));
  const list = useInfiniteList<Report, Paginated<Report>>(useStaffReports(status));
  const resolve = useResolveReport();
  const dismiss = useDismissReport();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const close = (kind: 'resolve' | 'dismiss') => setPending((now) => (now?.kind === kind ? null : now));
  const current = pending?.report;

  // A report that was handled elsewhere, or is gone: the queue is stale, load it again.
  const reloadIfStale = (error: unknown) => {
    if (hasCode(error, 'lineup_report_already_handled', 'lineup_report_not_found')) {
      void queryClient.invalidateQueries({queryKey: queryKeys.staffReportQueues()});
    }
  };

  return (
    <Bento>
      <Stack span={8}>
        <Section
          title={t('nav.reports')}
          actions={
            <Select
              className="staff-filter"
              label={t('reports.status')}
              value={status}
              onValueChange={(value) => {
                const next = new URLSearchParams(params);
                if (value === 'open') next.delete('status');
                else next.set('status', value);
                setParams(next, {replace: true});
              }}
              options={REPORT_STATUSES.map((value) => ({value, label: t(`reports.statuses.${value}`)}))}
            />
          }
        >
          <ListBody
            list={list}
            emptyIcon="flag"
            emptyTitle={status === 'open' ? t('reports.empty.openTitle') : t('reports.empty.title')}
            emptyText={status === 'open' ? t('reports.empty.openText') : t('reports.empty.text')}
          >
            <ul className="staff-items">
              {list.items.map((report) => (
                <ReportItem
                  key={report.id}
                  report={report}
                  onResolve={() => setPending({kind: 'resolve', report})}
                  onDismiss={() => setPending({kind: 'dismiss', report})}
                />
              ))}
            </ul>
          </ListBody>
        </Section>
      </Stack>
      <Stack span={4} sticky>
        <Card>
          <Shape shape="hexagon" tone="tertiary" icon="info" />
          <h2>{t('reports.help.title')}</h2>
          <ol className="staff-steps">
            <li>{t('reports.help.target')}</li>
            <li>{t('reports.help.once')}</li>
          </ol>
          {!list.isLoading && !list.isError && <p>{t('reports.loaded', {n: formatNumber(list.items.length)})}</p>}
        </Card>
      </Stack>

      <ActionDialog
        open={pending?.kind === 'resolve'}
        onClose={() => close('resolve')}
        headline={t('reports.resolve.title')}
        intro={t('reports.resolve.text')}
        confirmLabel={t('reports.resolve.confirm')}
        successMessage={t('reports.resolve.done')}
        onSubmit={() => resolve.mutateAsync(current!.id)}
        onFailure={reloadIfStale}
      />
      <ActionDialog
        open={pending?.kind === 'dismiss'}
        onClose={() => close('dismiss')}
        headline={t('reports.dismiss.title')}
        intro={t('reports.dismiss.text')}
        confirmLabel={t('reports.dismiss.confirm')}
        successMessage={t('reports.dismiss.done')}
        onSubmit={() => dismiss.mutateAsync(current!.id)}
        onFailure={reloadIfStale}
      />
    </Bento>
  );
}

function ReportItem({report, onResolve, onDismiss}: {report: Report; onResolve: () => void; onDismiss: () => void}) {
  const {t} = useT('staff');
  const view = TARGET_VIEW[report.target_type];
  const open = report.status === 'open';
  return (
    <li className="panel staff-item">
      <div className="staff-item-head">
        <span className="staff-person">
          <Shape shape={view.shape} tone={view.tone} icon={view.icon} small />
          <strong>{t(`reports.targets.${report.target_type}`)}</strong>
          <Chip
            to={targetPath(report)}
            mono
            aria-label={t('reports.open', {target: t(`reports.targets.${report.target_type}`)})}
          >
            {report.target_id}
          </Chip>
        </span>
        <span className="staff-item-meta">
          <Status variant={open ? 'accent' : 'default'}>{t(`reports.states.${report.status}`)}</Status>
          <RelativeTime value={report.created_at} />
        </span>
      </div>
      <p>
        <strong>{t(`reports.reasons.${report.reason}`)}</strong>
      </p>
      {report.details ? <p>{report.details}</p> : <p className="staff-item-meta">{t('reports.noDetails')}</p>}
      <dl className="staff-facts">
        <div>
          <dt>{t('reports.reporter')}</dt>
          <dd>
            <PersonLink id={report.reporter_id} />
          </dd>
        </div>
        {report.handled_by && (
          <div>
            <dt>{t('reports.handledBy')}</dt>
            <dd>
              <PersonLink id={report.handled_by} />
            </dd>
          </div>
        )}
      </dl>
      {open && (
        <div className="staff-item-actions">
          {report.target_type === 'post' && (
            <LinkButton
              variant="text"
              icon="visibility_off"
              to={`${paths.staffPosts()}?post=${encodeURIComponent(report.target_id)}&action=hide`}
            >
              {t('reports.hidePost')}
            </LinkButton>
          )}
          <md-outlined-button onclick={onDismiss}>{t('reports.dismiss.action')}</md-outlined-button>
          <md-filled-button onclick={onResolve}>{t('reports.resolve.action')}</md-filled-button>
        </div>
      )}
    </li>
  );
}
