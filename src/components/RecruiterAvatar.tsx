import type {AvatarSize} from '@/ui';

import {BotAvatar} from './BotAvatar';
import {GuildIcon} from './GuildIcon';
import type {Recruiter} from './recruiter';
import {UserAvatar} from './UserAvatar';

/** The picture of a recruiter: a server's square icon, a bot's or a person's round avatar. */
export function RecruiterAvatar({recruiter, size}: {recruiter: Recruiter; size?: AvatarSize}) {
  if (recruiter.entity === 'guild') return <GuildIcon id={recruiter.id} iconUrl={recruiter.imageUrl} size={size} />;
  if (recruiter.entity === 'bot') return <BotAvatar id={recruiter.id} src={recruiter.imageUrl} size={size} />;
  return <UserAvatar id={recruiter.id} src={recruiter.imageUrl} size={size} />;
}
