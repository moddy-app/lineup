import {PostsManager} from '../my-posts/MyPostsPage';
import {useManagedGuild} from './useManagedGuild';

/** /guilds/:guildId/manage/posts : the posts of the server, same list as "My posts". */
export function Component() {
  return <PostsManager guild={useManagedGuild()} />;
}
