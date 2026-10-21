import {type ReactNode, useState} from 'react';
import {useSearchParams} from 'react-router';

import {useStaffRejectExperience, useStaffVerifyExperience} from '@/api/mutations';
import {useStaffExperiences} from '@/api/queries';
import {useInfiniteList} from '@/api/pagination';
import type {Paginated, StaffExperience} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {RelativeTime} from '@/components';
import {ExperienceRow} from '@/components/ExperienceRow';
import {useT} from '@/i18n/useT';
import {Card, Pill, Status} from '@/ui';
import {formatNumber} from '@/lib/format';

import {ActionDialog, ListBody, PersonLink, Rules, SectionHead, StatusChips} from './parts';
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
    <>
      <section className="staff-section">
        <SectionHead title={t('nav.reviews')}>
          <StatusChips
            label={t('reviews.status')}
            value={status}
            onChange={(value) => {
              const next = new URLSearchParams(params);
              if (value === 'pending') next.delete('status');
              else next.set('status', value);
              setParams(next, {replace: true});
            }}
            options={REVIEW_STATUSES.map((value) => ({value, label: t(`reviews.statuses.${value}`)}))}
          />
        </SectionHead>
        <Rules title={t('reviews.help.title')}>
          <li>{t('reviews.help.order')}</li>
          <li>{t('reviews.help.verify')}</li>
          <li>{t('reviews.help.reject')}</li>
        </Rules>
        <Card className="staff-card">
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
        </Card>
      </section>

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
    </>
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
    <li className="staff-item inner-card">
      <div className="staff-item-main">
        <div className="staff-item-head">
          <PersonLink id={experience.user_id} showId />
          <span className="staff-item-meta">
            {t('reviews.updated')} <RelativeTime value={experience.updated_at} />
            {verification.status !== 'pending' && (
              <Status variant={verification.status === 'rejected' ? 'error' : 'default'}>
                {t(`reviews.statuses.${verification.status}`)}
              </Status>
            )}
          </span>
        </div>
        <ExperienceRow
          as="div"
          experience={experience}
          href={experience.guild_id ? paths.guild(experience.guild_id) : undefined}
        />
        {facts.length > 0 ? (
          <details className="staff-evidence">
            <summary>{t('reviews.evidence')}</summary>
            <dl className="staff-facts">
              {facts.map(([label, value, isError]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className={isError ? 'is-error' : undefined}>{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : (
          <p className="staff-item-meta">{t('reviews.facts.none')}</p>
        )}
      </div>
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
