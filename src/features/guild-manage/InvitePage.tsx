import {useEffect, useRef} from 'react';

import {hasCode} from '@/api/client';
import {FIELD_LIMITS} from '@/api/limits';
import {InviteHelp} from '@/components';
import {useT} from '@/i18n/useT';
import {Pill, SettingsPanel, Status, TextField} from '@/ui';

import {SaveBar} from './SaveBar';
import {useGuildForm} from './useGuildForm';
import {useManagedGuild} from './useManagedGuild';

/** /guilds/:guildId/manage/invite : the invitation behind the Join button. */
export function Component() {
  const guild = useManagedGuild();
  const {t} = useT('guildManage');
  const form = useGuildForm(guild, 'invite');
  const {values, set, inviteError} = form;
  const inviteDetails = useRef<HTMLDetailsElement>(null);

  // An invitation that expires: open the help that says how to make a permanent one.
  const error = form.bar.error;
  useEffect(() => {
    if (hasCode(error, 'invite_expiring') && inviteDetails.current) inviteDetails.current.open = true;
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
      <SettingsPanel className="manage-panel" title={t('invite.title')} description={t('invite.description')}>
        <p className="manage-current">
          {guild.invite ? (
            <>
              <span>{t('invite.current')}</span>
              <Pill>{guild.invite.code}</Pill>
              <Status variant={guild.invite.valid ? 'accent' : 'error'}>
                {guild.invite.valid ? t('invite.valid') : t('invite.lost')}
              </Status>
            </>
          ) : (
            t('invite.none')
          )}
        </p>
        {guild.invite && !guild.invite.valid && <p className="manage-help">{t('invite.lostHelp')}</p>}
        <TextField
          label={t('invite.label')}
          value={values.invite}
          onValueChange={(invite) => set({invite})}
          placeholder={t('invite.placeholder')}
          supportingText={t('invite.hint')}
          errorText={inviteError}
          maxLength={FIELD_LIMITS.guild.inviteMax}
          autocomplete="off"
          inputMode="url"
        />
        <details className="manage-details" ref={inviteDetails}>
          <summary>{t('invite.how')}</summary>
          <InviteHelp hideTitle />
        </details>
      </SettingsPanel>

      <SaveBar {...form.bar} />
    </form>
  );
}
