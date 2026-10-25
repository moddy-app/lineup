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
import {Card, Chip, Icon, LinkButton, Status} from '@/ui';

import {ActionDialog, EntityName, ListBody, PersonLink, Rules, SectionHead, StatusChips} from './parts';
import {parseReportStatus, REPORT_STATUSES} from './staffLogic';

const TARGET_ICON: Record<ReportTargetType, string> = {
  post: 'campaign',
  user: 'person',
  guild: 'groups',
  bot: 'smart_toy',
};

function targetPath(report: Report): string {
  switch (report.target_type) {
    case 'post':
      return paths.post(report.target_id);
    case 'user':
      return paths.user(report.target_id);
    case 'guild':
      return paths.guild(report.target_id);
    case 'bot':
      return paths.bot(report.target_id);
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
    <>
      <section className="staff-section">
        <SectionHead title={t('nav.reports')}>
          <StatusChips
            label={t('reports.status')}
            value={status}
            onChange={(value) => {
              const next = new URLSearchParams(params);
              if (value === 'open') next.delete('status');
              else next.set('status', value);
              setParams(next, {replace: true});
            }}
            options={REPORT_STATUSES.map((value) => ({value, label: t(`reports.statuses.${value}`)}))}
          />
        </SectionHead>
        <Rules title={t('reports.help.title')}>
          <li>{t('reports.help.target')}</li>
          <li>{t('reports.help.once')}</li>
        </Rules>
        <Card className="staff-card">
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
        </Card>
      </section>

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
    </>
  );
}

function ReportItem({report, onResolve, onDismiss}: {report: Report; onResolve: () => void; onDismiss: () => void}) {
  const {t} = useT('staff');
  const open = report.status === 'open';
  const target = t(`reports.targets.${report.target_type}`);
  return (
    <li className="staff-item inner-card">
      <div className="staff-item-main">
        <div className="staff-item-head">
          <span className="staff-person">
            <Icon name={TARGET_ICON[report.target_type]} />
            <strong>{target}</strong>
            {report.target_type === 'post' ? (
              <Chip to={targetPath(report)} mono aria-label={t('reports.open', {target})}>
                {report.target_id.slice(0, 8)}
              </Chip>
            ) : (
              <EntityName type={report.target_type} id={report.target_id} />
            )}
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
        <div className="staff-item-meta">
          <span>{t('reports.reporter')}</span>
          <PersonLink id={report.reporter_id} />
          {report.handled_by && (
            <>
              <span>{t('reports.handledBy')}</span>
              <PersonLink id={report.handled_by} />
            </>
          )}
        </div>
      </div>
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
