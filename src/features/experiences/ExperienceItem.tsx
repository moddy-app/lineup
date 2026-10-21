/** One experience in my list: drag handle, the timeline row, edit and a menu (move, delete), and its verification. */

import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import type {MdIconButton} from '@material/web/iconbutton/icon-button.js';
import type {MdMenu} from '@material/web/menu/menu.js';
import {useLayoutEffect, useRef, useState} from 'react';

import type {PrivateExperience} from '@/api/types';
import {ExperienceRow} from '@/components/ExperienceRow';
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
  const {t: tCommon} = useT('common');
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({
    id: experience.id,
    disabled,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const button = useRef<MdIconButton>(null);
  const menu = useRef<MdMenu>(null);
  useLayoutEffect(() => {
    if (menu.current) menu.current.anchorElement = button.current;
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
        lookupGuild
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
          <md-icon-button
            ref={button}
            type="button"
            aria-label={`${t('list.more')} : ${title}`}
            title={t('list.more')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onclick={() => setMenuOpen((open) => !open)}
          >
            <md-icon>more_vert</md-icon>
          </md-icon-button>
          <md-menu
            ref={menu}
            open={menuOpen}
            onclose={() => setMenuOpen(false)}
            anchorCorner="end-end"
            menuCorner="start-end"
          >
            <md-menu-item
              disabled={disabled || index === 0}
              aria-label={t('list.moveUp', {title})}
              onclick={() => onMove(index, index - 1)}
            >
              <md-icon slot="start" aria-hidden="true">
                arrow_upward
              </md-icon>
              <div slot="headline">{t('list.up')}</div>
            </md-menu-item>
            <md-menu-item
              disabled={disabled || index === total - 1}
              aria-label={t('list.moveDown', {title})}
              onclick={() => onMove(index, index + 1)}
            >
              <md-icon slot="start" aria-hidden="true">
                arrow_downward
              </md-icon>
              <div slot="headline">{t('list.down')}</div>
            </md-menu-item>
            <md-menu-item className="exp-delete" disabled={disabled} onclick={() => onDelete(experience)}>
              <md-icon slot="start" aria-hidden="true">
                delete
              </md-icon>
              <div slot="headline">{tCommon('actions.delete')}</div>
            </md-menu-item>
          </md-menu>
        </span>
      </div>
    </li>
  );
}
