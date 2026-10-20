/**
 * The age screen for adult content (LINEUP.md §9: the API never blocks a NSFW
 * server or post, the front does). `<NsfwGate nsfw={isNsfw(guild)}>…</NsfwGate>`
 * shows its content, or, for adult content not yet confirmed on this device,
 * a card asking for confirmation. The confirmation is remembered (`useNsfwConfirmed`).
 *
 * `NsfwConfirmDialog` asks the same thing before the feed's "include NSFW"
 * switch turns on.
 */

import type {ReactNode} from 'react';
import {useNavigate} from 'react-router';

import {paths} from '@/app/paths';
import {useT} from '@/i18n/useT';
import {Card, CardActions, Dialog, Shape} from '@/ui';

import {useNsfwConfirmed} from './nsfw';

interface NsfwGateProps {
  /** The content is for adults (`isNsfw(...)`). */
  nsfw: boolean;
  children: ReactNode;
  /** Where "Retour" goes when there is no page to go back to. The feed by default. */
  backTo?: string;
  /** The heading level of the screen's title. */
  headingLevel?: 1 | 2;
}

export function NsfwGate({nsfw, children, backTo, headingLevel = 2}: NsfwGateProps) {
  const {t} = useT('components');
  const {confirmed, confirm} = useNsfwConfirmed();
  const navigate = useNavigate();

  if (!nsfw || confirmed) return <>{children}</>;

  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const back = () => {
    // Arrived on this page directly: there is nothing behind, go to the feed.
    const index = (window.history.state as {idx?: number} | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate(backTo ?? paths.feed());
  };

  return (
    <Card className="nsfw-gate">
      <Shape shape="octagon" tone="tertiary" icon="explicit" />
      <Heading>{t('nsfw.title')}</Heading>
      <p>{t('nsfw.body')}</p>
      <CardActions>
        <md-filled-button onclick={confirm}>{t('nsfw.confirm')}</md-filled-button>
        <md-outlined-button onclick={back}>{t('nsfw.back')}</md-outlined-button>
      </CardActions>
    </Card>
  );
}

interface NsfwConfirmDialogProps {
  open: boolean;
  /** The person confirmed (and it is remembered). */
  onConfirmed: () => void;
  onCancel: () => void;
}

export function NsfwConfirmDialog({open, onConfirmed, onCancel}: NsfwConfirmDialogProps) {
  const {t} = useT('components');
  const {t: tCommon} = useT('common');
  const {confirm} = useNsfwConfirmed();
  return (
    <Dialog
      open={open}
      type="alert"
      onClose={onCancel}
      headline={t('nsfw.dialog.title')}
      actions={
        <>
          <md-text-button onclick={onCancel}>{tCommon('actions.cancel')}</md-text-button>
          <md-filled-button
            onclick={() => {
              confirm();
              onConfirmed();
            }}
          >
            {t('nsfw.dialog.confirm')}
          </md-filled-button>
        </>
      }
    >
      {t('nsfw.dialog.body')}
    </Dialog>
  );
}
