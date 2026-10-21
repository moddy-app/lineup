import {type ReactNode, useState} from 'react';
import {useSearchParams} from 'react-router';

import {useStaffRejectExperience, useStaffVerifyExperience} from '@/api/mutations';
import {useStaffExperiences} from '@/api/queries';
import {useInfiniteList} from '@/api/pagination';
import type {Paginated, StaffExperience} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {ExperienceRow, RelativeTime} from '@/components';
import {useT} from '@/i18n/useT';
import {Bento, Card, Pill, Rows, Section, Select, Shape, Stack, Status} from '@/ui';
import {formatNumber} from '@/lib/format';

import {ActionDialog, ListBody, PersonLink} from './parts';
import {parseReviewStatus, REASON_MAX, REVIEW_STATUSES} from './staffLogic';

type Pending = {kind: 'verify' | 'reject'; experience: StaffExperience} | null;

export function Component() {
  const {t} = useT('staff');
  usePageTitle(`${t('nav.reviews')} · ${t('title')}`);
  const [params, setParams] = useSearchParams();
  const status = parseReviewStatus(params.get('status'));
  const list = useInfiniteList<StaffExperience, Paginated<StaffExperience>>(useStaffExperiences(status));
  const verify = useStaffVerifyExperience();
  const reject = useStaffRejectExperience();
  const [pending, setPending] = useState<Pending>(null);

  const close = (kind: 'verify' | 'reject') => setPending((now) => (now?.kind === kind ? null : now));
  const current = pending?.experience;

  return (
    <Bento>
      <Stack span={8}>
        <Section
          title={t('nav.reviews')}
          actions={
            <Select
              className="staff-filter"
              label={t('reviews.status')}
              value={status}
              onValueChange={(value) => {
                const next = new URLSearchParams(params);
                if (value === 'pending') next.delete('status');
                else next.set('status', value);
                setParams(next, {replace: true});
              }}
              options={REVIEW_STATUSES.map((value) => ({value, label: t(`reviews.statuses.${value}`)}))}
            />
          }
        >
          <ListBody
            list={list}
            emptyIcon="task_alt"
            emptyTitle={status === 'pending' ? t('reviews.empty.pendingTitle') : t('reviews.empty.title')}
            emptyText={status === 'pending' ? t('reviews.empty.pendingText') : t('reviews.empty.text')}
          >
            <ul className="staff-items">
              {list.items.map((experience) => (
                <ReviewItem
                  key={experience.id}
                  experience={experience}
                  onVerify={() => setPending({kind: 'verify', experience})}
                  onReject={() => setPending({kind: 'reject', experience})}
                />
              ))}
            </ul>
          </ListBody>
        </Section>
      </Stack>
      <Stack span={4} sticky>
        <Card>
          <Shape shape="pentagon" tone="secondary" icon="rule" />
          <h2>{t('reviews.help.title')}</h2>
          <ol className="staff-steps">
            <li>{t('reviews.help.order')}</li>
            <li>{t('reviews.help.verify')}</li>
            <li>{t('reviews.help.reject')}</li>
          </ol>
          {!list.isLoading && !list.isError && <p>{t('reviews.loaded', {n: formatNumber(list.items.length)})}</p>}
        </Card>
      </Stack>

      <ActionDialog
        open={pending?.kind === 'verify'}
        onClose={() => close('verify')}
        headline={t('reviews.verify.title')}
        intro={t('reviews.verify.text')}
        field={{name: 'note', label: t('reviews.verify.note'), required: false, maxLength: REASON_MAX}}
        confirmLabel={t('reviews.verify.confirm')}
        successMessage={t('reviews.verify.done')}
        onSubmit={(note) => verify.mutateAsync({experienceId: current!.id, note: note || undefined})}
      />
      <ActionDialog
        open={pending?.kind === 'reject'}
        onClose={() => close('reject')}
        headline={t('reviews.reject.title')}
        intro={t('reviews.reject.text')}
        field={{name: 'reason', label: t('reviews.reject.reason'), required: true, maxLength: REASON_MAX}}
        confirmLabel={t('reviews.reject.confirm')}
        destructive
        successMessage={t('reviews.reject.done')}
        onSubmit={(reason) => reject.mutateAsync({experienceId: current!.id, reason})}
      />
    </Bento>
  );
}

function ReviewItem({
  experience,
  onVerify,
  onReject,
}: {
  experience: StaffExperience;
  onVerify: () => void;
  onReject: () => void;
}) {
  const {t} = useT('staff');
  const {verification} = experience;
  const evidence = verification.evidence;
  const facts: Array<[string, ReactNode, boolean?]> = [];
  if (evidence?.requested_at)
    facts.push([t('reviews.facts.requestedAt'), <RelativeTime key="r" value={evidence.requested_at} />]);
  if (evidence?.review_note) facts.push([t('reviews.facts.reviewNote'), evidence.review_note]);
  if (evidence?.permissions && evidence.permissions.length > 0) {
    facts.push([
      t('reviews.facts.permissions'),
      evidence.permissions.map((permission) => <Pill key={permission}>{permission}</Pill>),
    ]);
  }
  if (evidence?.owner !== undefined)
    facts.push([t('reviews.facts.owner'), evidence.owner ? t('reviews.facts.yes') : t('reviews.facts.no')]);
  if (evidence?.role_count !== undefined) facts.push([t('reviews.facts.roles'), formatNumber(evidence.role_count)]);
  if (evidence?.checked_at)
    facts.push([t('reviews.facts.checkedAt'), <RelativeTime key="c" value={evidence.checked_at} />]);
  if (evidence?.staff_note) facts.push([t('reviews.facts.staffNote'), evidence.staff_note]);
  if (verification.rejection_reason) facts.push([t('reviews.facts.rejection'), verification.rejection_reason, true]);

  return (
    <li className="panel staff-item">
      <div className="staff-item-head">
        <PersonLink id={experience.user_id} lookup />
        <span className="staff-item-meta">
          {t('reviews.updated')} <RelativeTime value={experience.updated_at} />
          {verification.status !== 'pending' && (
            <Status variant={verification.status === 'rejected' ? 'error' : 'default'}>
              {t(`reviews.statuses.${verification.status}`)}
            </Status>
          )}
        </span>
      </div>
      <Rows>
        <ExperienceRow
          experience={experience}
          href={experience.guild_id ? paths.guild(experience.guild_id) : undefined}
        />
      </Rows>
      {facts.length > 0 ? (
        <dl className="staff-facts">
          {facts.map(([label, value, isError]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={isError ? 'is-error' : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="staff-item-meta">{t('reviews.facts.none')}</p>
      )}
      <div className="staff-item-actions">
        {verification.status !== 'rejected' && (
          <md-outlined-button onclick={onReject}>{t('reviews.reject.action')}</md-outlined-button>
        )}
        {verification.status !== 'verified' && (
          <md-filled-button onclick={onVerify}>{t('reviews.verify.action')}</md-filled-button>
        )}
      </div>
    </li>
  );
}
