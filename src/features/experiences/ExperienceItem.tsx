/** One experience in my list: drag handle, the timeline row, edit and a menu (move, delete), and its verification. */

import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

import type {PrivateExperience} from '@/api/types';
import {ExperienceRow} from '@/components/ExperienceRow';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Dropdown, Icon} from '@/ui';

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
  const {t: tCommon} = useT('common');
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({
    id: experience.id,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      className={cx('exp-item', 'inner-card', isDragging && 'is-dragging')}
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
        as="div"
        className="exp-row"
        experience={experience}
        actions={<VerificationBox experience={experience} />}
      />
      <div className="exp-tools">
        <md-icon-button
          type="button"
          aria-label={`${t('list.edit')} : ${title}`}
          title={t('list.edit')}
          disabled={disabled}
          onclick={() => onEdit(experience)}
        >
          <md-icon>edit</md-icon>
        </md-icon-button>
        <span className="exp-menu">
          <Dropdown
            align="end"
            label={`${t('list.more')} : ${title}`}
            items={[
              {
                key: 'up',
                icon: 'arrow_upward',
                label: t('list.up'),
                disabled: disabled || index === 0,
                onSelect: () => onMove(index, index - 1),
              },
              {
                key: 'down',
                icon: 'arrow_downward',
                label: t('list.down'),
                disabled: disabled || index === total - 1,
                onSelect: () => onMove(index, index + 1),
              },
              {
                key: 'delete',
                icon: 'delete',
                label: tCommon('actions.delete'),
                destructive: true,
                separated: true,
                disabled,
                onSelect: () => onDelete(experience),
              },
            ]}
            trigger={({ref, onActivate, ...aria}) => (
              <md-icon-button
                {...aria}
                ref={ref}
                type="button"
                aria-label={`${t('list.more')} : ${title}`}
                title={t('list.more')}
                onclick={onActivate}
              >
                <md-icon>more_vert</md-icon>
              </md-icon-button>
            )}
          />
        </span>
      </div>
    </li>
  );
}
