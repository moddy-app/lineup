import type {MdDialog} from '@material/web/dialog/dialog.js';
import type {DialogAnimation} from '@material/web/dialog/internal/animations.js';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';

import {useT} from '@/i18n/useT';

import {allowsMotion} from './motion';

/** The scrim of md-dialog at rest (Material). */
const SCRIM = 0.32;
/** The kit's `--ease`. */
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

/** A quiet entrance: the dialog fades in from 96% and 4px lower, the scrim fades in. */
const OPEN: DialogAnimation = {
  dialog: [
    [
      [
        {opacity: 0, transform: 'translateY(4px) scale(0.96)'},
        {opacity: 1, transform: 'none'},
      ],
      {duration: 200, easing: EASE},
    ],
  ],
  scrim: [[[{opacity: 0}, {opacity: SCRIM}], {duration: 150, easing: 'linear'}]],
};

/** The same, backwards and quicker (the kit's motion: 150 to 400 ms). */
const CLOSE: DialogAnimation = {
  dialog: [
    [
      [
        {opacity: 1, transform: 'none'},
        {opacity: 0, transform: 'scale(0.96)'},
      ],
      {duration: 150, easing: EASE, fill: 'forwards'},
    ],
  ],
  scrim: [[[{opacity: SCRIM}, {opacity: 0}], {duration: 150, easing: 'linear', fill: 'forwards'}]],
};

/** Replaces Material's slide and grow; nothing moves under `prefers-reduced-motion: reduce`. */
function quietAnimations(element: MdDialog | null) {
  if (!element) return;
  element.getOpenAnimation = () => (allowsMotion() ? OPEN : {});
  element.getCloseAnimation = () => (allowsMotion() ? CLOSE : {});
}

interface DialogProps {
  open: boolean;
  /** Called when the dialog asks to close (Escape, scrim click, a close button). */
  onClose: () => void;
  headline: ReactNode;
  children: ReactNode;
  /** The buttons (md-text-button, md-filled-button…), right-aligned by the dialog. */
  actions?: ReactNode;
  /** `alert`: no closing by scrim click; for confirmations. */
  type?: 'alert';
  className?: string;
}

/**
 * md-dialog, controlled by `open`. Content is always in the DOM (the dialog
 * animates in and out: a fade and a slight zoom, see `OPEN`), so keep heavy
 * content out of it until `open`.
 *
 * Rendered in a portal on `document.body`. md-dialog draws its scrim as a
 * fixed `div` in its own shadow root, not in the top layer, so the scrim only
 * covers what is below its stacking context. Under `body`, the host gets its
 * own stacking context above the app bar and the cards' edge caps
 * (`md-dialog` in lineup.css): the scrim then dims the whole window. Every
 * dialog of the app goes through this component; never use `md-dialog` directly.
 */
export function Dialog({open, onClose, headline, children, actions, type, className}: DialogProps) {
  return createPortal(
    <md-dialog
      ref={quietAnimations}
      className={className}
      open={open}
      type={type}
      // `close` also bubbles up from a select or menu inside the dialog.
      onclose={(event: Event & {currentTarget: MdDialog}) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div slot="headline">{headline}</div>
      <div slot="content">{children}</div>
      {actions && <div slot="actions">{actions}</div>}
    </md-dialog>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Delete, sign out: the confirm button turns to the error colors. */
  destructive?: boolean;
  /** Disables both buttons while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Are you sure" for an action that cannot be undone, or that costs something. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const {t} = useT('common');
  return (
    <Dialog
      open={open}
      type="alert"
      onClose={onCancel}
      headline={title}
      actions={
        <>
          <md-text-button disabled={busy} onclick={onCancel}>
            {cancelLabel ?? t('actions.cancel')}
          </md-text-button>
          <md-filled-button className={destructive ? 'destructive' : undefined} disabled={busy} onclick={onConfirm}>
            {confirmLabel}
          </md-filled-button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}
