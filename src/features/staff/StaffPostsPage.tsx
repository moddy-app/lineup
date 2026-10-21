import {useState} from 'react';
import {useSearchParams} from 'react-router';

import {hasCode} from '@/api/client';
import {useHidePost, useUnhidePost} from '@/api/mutations';
import {usePost} from '@/api/queries';
import {usePageTitle} from '@/app/usePageTitle';
import {PostCard} from '@/components';
import {useT} from '@/i18n/useT';
import {Bento, Card, Rows, Section, Shape, Spinner, Stack, TextField} from '@/ui';

import {ActionDialog, StaffListError} from './parts';
import {extractPostId, REASON_MAX} from './staffLogic';

export function Component() {
  const {t} = useT('staff');
  usePageTitle(`${t('nav.posts')} · ${t('title')}`);
  const [params, setParams] = useSearchParams();
  const postId = extractPostId(params.get('post') ?? '') ?? undefined;
  const wantsHide = params.get('action') === 'hide';
  const [input, setInput] = useState(params.get('post') ?? '');
  const [invalid, setInvalid] = useState(false);
  const post = usePost(postId);
  const hide = useHidePost();
  const unhide = useUnhidePost();
  const [dialog, setDialog] = useState<'hide' | 'unhide' | null>(null);

  const data = post.data;
  const hidden = data?.status === 'hidden';

  // "Hide this post" from a report arrives with ?action=hide: the dialog opens once the post is here.
  const autoHide = wantsHide && !!data && !hidden;
  const closeDialog = (kind: 'hide' | 'unhide') => {
    setDialog((now) => (now === kind ? null : now));
    if (kind === 'hide' && wantsHide) {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('action');
          return next;
        },
        {replace: true},
      );
    }
  };

  function lookUp() {
    const id = extractPostId(input);
    setInvalid(id === null);
    if (id) setParams({post: id}, {replace: true});
  }

  const staleHidden = (error: unknown) => {
    // Not hidden after all (someone else was first): show the post as it is now.
    if (hasCode(error, 'lineup_post_not_hidden')) void post.refetch();
  };

  return (
    <Bento>
      <Stack span={8}>
        <Section title={t('nav.posts')}>
          <form
            className="staff-lookup"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              lookUp();
            }}
          >
            <TextField
              label={t('posts.lookup.label')}
              value={input}
              onValueChange={(value) => {
                setInput(value);
                setInvalid(false);
              }}
              autocomplete="off"
              supportingText={t('posts.lookup.hint')}
              errorText={invalid ? t('posts.lookup.invalid') : undefined}
            />
            <md-filled-button type="submit">{t('posts.lookup.submit')}</md-filled-button>
          </form>

          {postId === undefined ? (
            <div className="empty-state compact">
              <Shape shape="hexagon" tone="secondary" icon="search" small />
              <div className="empty-state-text">
                <h3>{t('posts.empty.title')}</h3>
                <p>{t('posts.empty.text')}</p>
              </div>
            </div>
          ) : post.isPending ? (
            <Spinner />
          ) : post.isError ? (
            <StaffListError error={post.error} onRetry={() => void post.refetch()} retrying={post.isRefetching} />
          ) : (
            data && (
              <div className="staff-found">
                <Rows>
                  <PostCard post={data} variant="row" showStatus />
                </Rows>
                {hidden && data.hidden_reason && (
                  <p className="staff-reason">
                    <strong>{t('posts.reason')}</strong> {data.hidden_reason}
                  </p>
                )}
                <div className="staff-item-actions">
                  {hidden ? (
                    <md-filled-button onclick={() => setDialog('unhide')}>{t('posts.unhide.action')}</md-filled-button>
                  ) : (
                    <md-filled-button className="destructive" onclick={() => setDialog('hide')}>
                      {t('posts.hide.action')}
                    </md-filled-button>
                  )}
                </div>
              </div>
            )
          )}
        </Section>
      </Stack>
      <Stack span={4} sticky>
        <Card>
          <Shape shape="octagon" tone="tertiary" icon="visibility_off" />
          <h2>{t('posts.help.title')}</h2>
          <ol className="staff-steps">
            <li>{t('posts.help.hide')}</li>
            <li>{t('posts.help.unhide')}</li>
          </ol>
        </Card>
      </Stack>

      <ActionDialog
        open={dialog === 'hide' || autoHide}
        onClose={() => closeDialog('hide')}
        headline={t('posts.hide.title')}
        intro={t('posts.hide.text')}
        field={{name: 'reason', label: t('posts.hide.reason'), required: true, maxLength: REASON_MAX}}
        confirmLabel={t('posts.hide.confirm')}
        destructive
        successMessage={t('posts.hide.done')}
        onSubmit={(reason) => hide.mutateAsync({postId: postId!, reason})}
      />
      <ActionDialog
        open={dialog === 'unhide'}
        onClose={() => closeDialog('unhide')}
        headline={t('posts.unhide.title')}
        intro={t('posts.unhide.text')}
        confirmLabel={t('posts.unhide.confirm')}
        successMessage={t('posts.unhide.done')}
        onSubmit={() => unhide.mutateAsync(postId!)}
        onFailure={staleHidden}
      />
    </Bento>
  );
}
