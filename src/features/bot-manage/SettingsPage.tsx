import {SaveBar} from '../guild-manage/SaveBar';
import {useBotForm} from '../guild-manage/useGuildForm';
import {useT} from '@/i18n/useT';
import {SettingsPanel, Switch} from '@/ui';

import {DangerZone} from './DangerZone';
import {useManagedBot} from './useManagedBot';

/** /bots/:botId/manage/settings : visibility in the directory, then the danger zone. */
export function Component() {
  const bot = useManagedBot();
  const {t} = useT('botManage');
  const form = useBotForm(bot, 'visibility');
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
        <SettingsPanel className="manage-panel" title={t('visibility.title')} description={t('visibility.description')}>
          <Switch
            checked={values.listed}
            onCheckedChange={(listed) => set({listed})}
            label={t('visibility.label')}
            description={values.listed ? t('visibility.on') : t('visibility.off')}
          />
        </SettingsPanel>
        <SaveBar {...form.bar} ns="botManage" />
      </form>
      <DangerZone bot={bot} />
    </>
  );
}
