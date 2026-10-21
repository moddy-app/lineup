import type {MdDialog} from '@material/web/dialog/dialog.js';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';

import {useT} from '@/i18n/useT';

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
 * animates in and out), so keep heavy content out of it until `open`.
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
