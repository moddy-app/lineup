/** One experience in my list: drag handle, the row, move buttons, edit and delete, and its verification. */

import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

import type {PrivateExperience} from '@/api/types';
import {ExperienceRow} from '@/components';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Icon} from '@/ui';

import {VerificationBox} from './VerificationBox';

interface ExperienceItemProps {
  experience: PrivateExperience;
  index: number;
  total: number;
  /** "Position, Name": for the buttons' names. */
  title: string;
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  onEdit: (experience: PrivateExperience) => void;
  onDelete: (experience: PrivateExperience) => void;
}

export function ExperienceItem({
  experience,
  index,
  total,
  title,
  disabled,
  onMove,
  onEdit,
  onDelete,
}: ExperienceItemProps) {
  const {t} = useT('experiences');
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({
    id: experience.id,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      className={cx('exp-item', isDragging && 'is-dragging')}
      style={{transform: CSS.Transform.toString(transform), transition}}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="exp-handle"
        aria-label={t('list.drag', {title})}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <Icon name="drag_indicator" />
      </button>
      <ExperienceRow
        className="exp-row"
        experience={experience}
        actions={
          <>
            <VerificationBox experience={experience} />
            <div className="exp-toolbar">
              <div className="exp-toolbar-group">
                <md-icon-button
                  type="button"
                  aria-label={t('list.moveUp', {title})}
                  disabled={disabled || index === 0}
                  onclick={() => onMove(index, index - 1)}
                >
                  <md-icon>arrow_upward</md-icon>
                </md-icon-button>
                <md-icon-button
                  type="button"
                  aria-label={t('list.moveDown', {title})}
                  disabled={disabled || index === total - 1}
                  onclick={() => onMove(index, index + 1)}
                >
                  <md-icon>arrow_downward</md-icon>
                </md-icon-button>
              </div>
              <div className="exp-toolbar-group">
                <md-text-button type="button" disabled={disabled} onclick={() => onEdit(experience)}>
                  <md-icon slot="icon" className="filled" aria-hidden="true">
                    edit
                  </md-icon>
                  {t('list.edit')}
                </md-text-button>
                <md-text-button
                  type="button"
                  className="exp-delete"
                  disabled={disabled}
                  onclick={() => onDelete(experience)}
                >
                  <md-icon slot="icon" className="filled" aria-hidden="true">
                    delete
                  </md-icon>
                  {t('list.delete')}
                </md-text-button>
              </div>
            </div>
          </>
        }
      />
    </li>
  );
}
