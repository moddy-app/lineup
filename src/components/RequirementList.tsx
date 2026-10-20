/**
 * The conditions of a post. One row each: the condition's name, then its value
 * ("16 ans minimum", "180 jours, environ 6 mois", "Français, Anglais").
 *
 * `verified_by_lineup` is a promise, never a verification (LINEUP.md §8): the
 * marker reads "Vérification par Lineup prévue" and its tooltip says nothing is
 * checked yet. Given the signed-in `viewer`, the two conditions Lineup can read
 * from an account (age of the account, a verified experience) also say whether
 * the viewer meets them, for information only.
 */

import {useCatalogLabel} from '@/api/catalog';
import {useCatalog} from '@/api/queries';
import type {Requirement} from '@/api/types';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {Icon, Row, Rows, Shape} from '@/ui';

import {useNow} from './useNow';
import {type RequirementViewer, requirementView, viewerMeets} from './requirements';

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
    <Rows as="ul" className="requirements" aria-label={t('requirement.label')}>
      {requirements.map((requirement, index) => {
        const entry = catalog?.requirements.find((candidate) => candidate.id === requirement.type);
        const view = requirementView(requirement, entry, label('requirements', requirement.type), ctx);
        const meets = viewer ? viewerMeets(requirement, viewer, now) : null;
        return (
          <Row key={`${requirement.type}:${index}`} className="requirement">
            <Shape small shape="square" tone="secondary" icon={view.icon} />
            <div className="row-body">
              <span className="row-title">{view.title}</span>
              {view.text && <span className="row-meta">{view.text}</span>}
              {view.promise && (
                <span
                  className="requirement-note promise tooltip-wrap"
                  data-tooltip={t('requirement.promise.hint')}
                  tabIndex={0}
                  aria-label={`${t('requirement.promise.label')}. ${t('requirement.promise.hint')}`}
                >
                  <Icon name="schedule" />
                  {t('requirement.promise.label')}
                </span>
              )}
              {meets !== null && (
                <span
                  className={
                    meets ? 'requirement-note viewer met tooltip-wrap' : 'requirement-note viewer tooltip-wrap'
                  }
                  data-tooltip={t('requirement.viewer.hint')}
                  tabIndex={0}
                  aria-label={`${meets ? t('requirement.viewer.met') : t('requirement.viewer.notYet')}. ${t('requirement.viewer.hint')}`}
                >
                  <Icon name={meets ? 'check_circle' : 'radio_button_unchecked'} filled={meets} />
                  {meets ? t('requirement.viewer.met') : t('requirement.viewer.notYet')}
                </span>
              )}
            </div>
          </Row>
        );
      })}
    </Rows>
  );
}
