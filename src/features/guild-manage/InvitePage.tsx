import {useEffect, useRef, useState} from 'react';

import {hasCode} from '@/api/client';
import {FIELD_LIMITS} from '@/api/limits';
import {InviteHelp, useCopyText} from '@/components';
import {useT} from '@/i18n/useT';
import {Icon, Pill, SettingsPanel, Status, TextField} from '@/ui';

import {RegenerateInvite} from './RegenerateInvite';
import {SaveBar} from './SaveBar';
import {useGuildForm} from './useGuildForm';
import {useManagedGuild} from './useManagedGuild';

/** /guilds/:guildId/manage/invite : the invitation behind the Join button. */
export function Component() {
  const guild = useManagedGuild();
  const {t} = useT('guildManage');
  const form = useGuildForm(guild, 'invite');
  const copy = useCopyText();
  const {values, set, inviteError} = form;
  const howTo = useRef<HTMLDetailsElement>(null);
  // The field opened by hand, for the invitation shown then: a saved one folds it again.
  const [pastingFor, setPastingFor] = useState<string | null | undefined>();

  // `invite.url` is null when the bot could not create a link: nothing to show.
  const invite = guild.invite && guild.invite.url !== null ? guild.invite : null;

  const code = invite?.code ?? null;
  const pasting = pastingFor === code;
  const lost = invite !== null && !invite.valid;
  // The field is the way out when there is no usable invitation, and the only way without Moddy.
  const showField = pasting || !invite || lost || !guild.has_moddy || values.invite !== '' || Boolean(inviteError);

  // An invitation that expires: open the help that says how to make a permanent one.
  const error = form.bar.error;
  useEffect(() => {
    if (hasCode(error, 'invite_expiring') && howTo.current) howTo.current.open = true;
  }, [error]);

  return (
    <form
      className="manage-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.save();
      }}
    >
      <SettingsPanel className="manage-panel" title={t('invite.title')}>
        <div className="invite-current">
          <div className="invite-code">
            {invite ? (
              <Pill>{`discord.gg/${invite.code}`}</Pill>
            ) : (
              <span className="invite-none">{t('invite.none')}</span>
            )}
            {lost && <Status variant="error">{t('invite.lost')}</Status>}
          </div>
          {invite?.url && (
            <span className="invite-copy tooltip-end" data-tooltip={t('invite.copy')}>
              <md-icon-button
                type="button"
                aria-label={t('invite.copy')}
                onclick={() => copy(invite.url!, t('invite.copied'), t('invite.copyFailed'))}
              >
                <Icon name="content_copy" />
              </md-icon-button>
            </span>
          )}
        </div>

        {guild.has_moddy && (
          <RegenerateInvite guild={guild} onManual={() => setPastingFor(code)}>
            {!showField && (
              <md-text-button type="button" onclick={() => setPastingFor(code)}>
                {t('invite.paste')}
              </md-text-button>
            )}
          </RegenerateInvite>
        )}

        {showField && (
          <div className="invite-field">
            <TextField
              label={t('invite.label')}
              value={values.invite}
              onValueChange={(next) => set({invite: next})}
              placeholder={t('invite.placeholder')}
              supportingText={t('invite.hint')}
              errorText={inviteError}
              maxLength={FIELD_LIMITS.guild.inviteMax}
              autocomplete="off"
              inputMode="url"
            />
            <details className="invite-howto" ref={howTo}>
              <summary>{t('invite.how')}</summary>
              <InviteHelp hideTitle />
            </details>
          </div>
        )}
      </SettingsPanel>

      <SaveBar {...form.bar} />
    </form>
  );
}
