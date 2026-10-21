import {useT} from '@/i18n/useT';
import {SettingsPanel, Switch} from '@/ui';

import {DangerZone} from './DangerZone';
import {SaveBar} from './SaveBar';
import {useGuildForm} from './useGuildForm';
import {useManagedGuild} from './useManagedGuild';

/** /guilds/:guildId/manage/settings : visibility, then the danger zone. */
export function Component() {
  const guild = useManagedGuild();
  const {t} = useT('guildManage');
  const form = useGuildForm(guild, 'visibility');
  const {values, set} = form;

  return (
    <>
      <form
        className="manage-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.save();
        }}
      >
        <SettingsPanel className="manage-panel" title={t('visibility.title')}>
          <Switch checked={values.listed} onCheckedChange={(listed) => set({listed})} label={t('visibility.label')} />
          <p className="manage-help">{values.listed ? t('visibility.on') : t('visibility.off')}</p>
        </SettingsPanel>
        <SaveBar {...form.bar} />
      </form>
      <DangerZone guild={guild} />
    </>
  );
}
