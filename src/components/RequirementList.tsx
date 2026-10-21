/**
 * The conditions of a post, one inner card each: an icon (a check, or an
 * info mark when Lineup's check is planned), the condition's name and its value
 * ("16 ans minimum", "180 jours, environ 6 mois", "Français, Anglais").
 *
 * `verified_by_lineup` is a promise, never a verification (LINEUP.md §8): the
 * marker reads "Vérification par Lineup prévue" and its tooltip says nothing is
 * checked yet. Given the signed-in `viewer`, the two conditions Lineup can read
 * from an account (age of the account, a verified experience) also say whether
 * the viewer meets them, for information only.
 */

import {useId} from 'react';

import {useCatalogLabel} from '@/api/catalog';
import {useCatalog} from '@/api/queries';
import type {Requirement} from '@/api/types';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {Icon, InnerCard, InnerCards, VisuallyHidden} from '@/ui';

import {tooltipSideProps} from './tooltipSide';
import {useNow} from './useNow';
import {type RequirementViewer, requirementView, viewerMeets} from './requirements';

interface NoteProps {
  className: string;
  icon?: string;
  filled?: boolean;
  text: string;
  /** What the note means, in a tooltip (and read as its description). */
  hint: string;
}

/** A small line under a condition: an icon, a short text, its meaning in a tooltip. */
function Note({className, icon, filled, text, hint}: NoteProps) {
  const hintId = useId();
  return (
    <>
      <span
        className={`requirement-note tooltip-wrap ${className}`}
        data-tooltip={hint}
        tabIndex={0}
        aria-describedby={hintId}
        {...tooltipSideProps}
      >
        {icon && <Icon name={icon} filled={filled} />}
        {text}
      </span>
      <VisuallyHidden id={hintId}>{hint}</VisuallyHidden>
    </>
  );
}

interface RequirementListProps {
  requirements: readonly Requirement[];
  viewer?: RequirementViewer | null;
}

export function RequirementList({requirements, viewer}: RequirementListProps) {
  const {t} = useT('components');
  const {label} = useCatalogLabel();
  const {data: catalog} = useCatalog();
  useLanguage();
  const now = useNow();
  if (requirements.length === 0) return null;

  const ctx = {t, languageName: (id: string) => label('languages', id)};

  return (
    <InnerCards className="requirements" aria-label={t('requirement.label')}>
      {requirements.map((requirement, index) => {
        const entry = catalog?.requirements.find((candidate) => candidate.id === requirement.type);
        const view = requirementView(requirement, entry, label('requirements', requirement.type), ctx);
        const meets = viewer ? viewerMeets(requirement, viewer, now) : null;
        return (
          <InnerCard as="li" key={`${requirement.type}:${index}`} className="requirement">
            <Icon name={view.promise ? 'info' : 'check'} className="requirement-icon" />
            <div className="requirement-body">
              <span className="requirement-title">{view.title}</span>
              {view.text && <span className="requirement-text">{view.text}</span>}
              {view.promise && (
                <Note className="promise" text={t('requirement.promise.label')} hint={t('requirement.promise.hint')} />
              )}
              {meets !== null && (
                <Note
                  className={meets ? 'viewer met' : 'viewer'}
                  icon={meets ? 'check_circle' : 'radio_button_unchecked'}
                  filled={meets}
                  text={meets ? t('requirement.viewer.met') : t('requirement.viewer.notYet')}
                  hint={t('requirement.viewer.hint')}
                />
              )}
            </div>
          </InnerCard>
        );
      })}
    </InnerCards>
  );
}
