import {ProfileEditor} from '../guild-manage/ProfilePage';
import {useBotForm} from '../guild-manage/useGuildForm';
import {useManagedBot} from './useManagedBot';

/** /bots/:botId/manage : the public profile (description, theme, tags, languages, links). */
export function Component() {
  const bot = useManagedBot();
  return <ProfileEditor form={useBotForm(bot, 'profile')} discordText={bot.app_description} ns="botManage" />;
}
