import {PostsManager} from '../my-posts/MyPostsPage';
import {useManagedBot} from './useManagedBot';

/** /bots/:botId/manage/posts : the posts of the bot, whoever wrote them, same list as "My posts". */
export function Component() {
  return <PostsManager bot={useManagedBot()} />;
}
