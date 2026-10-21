/**
 * Development only (/__ui): every UI primitive on one page, for looking at
 * them in light and dark, at 1400 and 390px, and for the browser checks of
 * the controlled fields. Not part of the product: it is left out of
 * production builds (see routes.tsx) and its strings are not translated.
 */

import {useState} from 'react';

import {DomainGallery} from './DomainGallery';
import {FoundationGallery} from './FoundationGallery';

import {
  Avatar,
  Bento,
  Card,
  CardActions,
  CardHead,
  CardText,
  CardVisual,
  Checkbox,
  Chip,
  Chips,
  ConfirmDialog,
  Dialog,
  Icon,
  LinkButton,
  Page,
  Panel,
  Pill,
  Row,
  RowBody,
  Rows,
  Section,
  Select,
  Shape,
  type ShapeName,
  type ShapeTone,
  Spinner,
  Stack,
  Stat,
  Status,
  Switch,
  Tile,
  Tiles,
  TextField,
  Tooltip,
  useSnackbar,
  InnerCard,
  InnerCards,
  Dropdown,
} from '@/ui';

const SHAPES: Array<[ShapeName, ShapeTone, string]> = [
  ['square', 'primary', 'campaign'],
  ['diamond', 'secondary', 'groups'],
  ['pentagon', 'tertiary', 'shield_person'],
  ['hexagon', 'solid', 'verified'],
  ['heptagon', 'primary', 'work_history'],
  ['octagon', 'secondary', 'explore_off'],
];

export function Component() {
  const snackbar = useSnackbar();
  const [text, setText] = useState('Hello');
  const [long, setLong] = useState('');
  const [upper, setUpper] = useState('ABC');
  const [kind, setKind] = useState('guild');
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [destructive, setDestructive] = useState(false);

  return (
    <Page>
      <Bento>
        <Card variant="hero">
          <h1>UI gallery</h1>
          <p>Every primitive of src/ui, on the kit's classes.</p>
        </Card>

        <Card>
          <h2>Functional layouts</h2>
          <p>
            Section, and the classes of AppLayout (main and aside) and SingleColumn. Every placeholder page uses
            SingleColumn.
          </p>
          <CardVisual>
            <div className="app-layout has-aside">
              <div className="app-main">
                <Section title="Section" actions={<md-outlined-button>Action</md-outlined-button>}>
                  <p>A card with a title row and its content.</p>
                </Section>
              </div>
              <aside className="app-aside">
                <Section title="Aside">
                  <p>Side column.</p>
                </Section>
              </aside>
            </div>
          </CardVisual>
        </Card>

        {SHAPES.map(([shape, tone, icon], index) => (
          <Card key={shape} span={4}>
            <Shape shape={shape} tone={tone} icon={icon} />
            <h2>{shape}</h2>
            <p>
              Tone {tone}, {index % 2 ? 'small' : 'default'} size below.
            </p>
            <CardVisual>
              <Shape shape={shape} tone={tone} icon={icon} small />
            </CardVisual>
          </Card>
        ))}

        <Card span={4}>
          <h2>InnerCard</h2>
          <InnerCards>
            <InnerCard as="li">
              <RowBody title="An inner card" meta="surface-container, no edge caps" />
            </InnerCard>
            <InnerCard as="li" to="/__ui">
              <Shape small shape="hexagon" tone="secondary" icon="link" />
              <RowBody title="An inner card, as a link" meta="quiet hover" />
            </InnerCard>
          </InnerCards>
        </Card>

        <Stack span={8}>
          <Card as="article">
            <CardHead>
              <Avatar src="/design-kit/assets/avatars/leo.webp" size="large" />
              <div className="row-body">
                <span className="row-title">
                  <strong>Léo Martin</strong>
                </span>
                <span className="row-meta">An article card with a head</span>
              </div>
            </CardHead>
            <CardVisual>
              <Rows>
                <Row>
                  <Shape shape="hexagon" tone="tertiary" icon="shield_person" small />
                  <RowBody title="Second account blocked" meta="case #4821" mono />
                  <Status variant="strong">Blocked</Status>
                </Row>
                <Row to="/guilds">
                  <Avatar src="/design-kit/assets/avatars/mia.webp" />
                  <RowBody title="A link row" meta="Goes to /guilds" />
                  <Status variant="accent">Accent</Status>
                  <Status variant="error">Error</Status>
                  <Status>Default</Status>
                </Row>
              </Rows>
              <Rows as="ul">
                <Row>
                  <Avatar src="/design-kit/assets/avatars/sam.webp" size="small" />
                  <RowBody title="A list item" />
                </Row>
                <Row to="/guilds/1">
                  <Avatar src="/design-kit/assets/avatars/alex.webp" size="small" />
                  <RowBody title="A list link item" />
                </Row>
              </Rows>
            </CardVisual>
            <CardActions>
              <md-text-button>
                <md-icon slot="icon" className="filled">
                  thumb_up
                </md-icon>
                36
              </md-text-button>
            </CardActions>
          </Card>

          <Card to="/guilds/42">
            <h2>A card link</h2>
            <p>The only card with a hover state.</p>
          </Card>

          <Card variant="split">
            <CardText>
              <h2>Split card</h2>
              <p>Text on one side, content on the other.</p>
              <CardActions>
                <LinkButton to="/guilds" icon="groups">
                  Servers
                </LinkButton>
                <LinkButton to="/" variant="outlined">
                  Posts
                </LinkButton>
                <LinkButton to="https://moddy.app" variant="text">
                  moddy.app
                </LinkButton>
              </CardActions>
            </CardText>
            <CardVisual>
              <Panel>
                <Stat value={12345} label="Members" />
                <Stat value="4.8" label="Rating" />
              </Panel>
            </CardVisual>
          </Card>
        </Stack>

        <Stack span={4} sticky>
          <Card>
            <h2>Chips and pills</h2>
            <Chips>
              <Chip>Moderation</Chip>
              <Chip icon="translate">Français</Chip>
              <Chip to="/guilds" icon="groups">
                A link chip
              </Chip>
              <Chip mono>/ban</Chip>
            </Chips>
            <CardVisual>
              <Pill>@alex</Pill>
              <Tiles>
                <Tile>
                  <strong>Primary</strong>
                </Tile>
                <Tile tint="secondary">
                  <strong>Secondary</strong>
                </Tile>
                <Tile tint="tertiary">
                  <strong>Tertiary</strong>
                </Tile>
              </Tiles>
              <p>
                <Tooltip text="Verified account">
                  <Icon name="check_circle" filled label="Verified account" />
                </Tooltip>{' '}
                tooltip
              </p>
            </CardVisual>
          </Card>
        </Stack>

        <Card span={6}>
          <h2>Fields</h2>
          <CardVisual>
            <TextField label="Controlled" value={text} onValueChange={setText} supportingText="Type here" />
            <output data-testid="text">{text}</output>
            <TextField
              label="Counter"
              value={long}
              onValueChange={setLong}
              maxLength={40}
              rows={3}
              supportingText="Textarea, 40 characters"
            />
            <output data-testid="long">{long}</output>
            <TextField
              label="Refuses lowercase"
              value={upper}
              onValueChange={(value) => setUpper(value === value.toUpperCase() ? value : upper)}
            />
            <output data-testid="upper">{upper}</output>
            <TextField
              label="With an error"
              value="x"
              onValueChange={() => {}}
              errorText="This value is not valid"
              required
            />
            <Select
              label="Kind"
              value={kind}
              onValueChange={setKind}
              options={[
                {value: 'guild', label: 'Server'},
                {value: 'user', label: 'Person'},
                {value: 'other', label: 'Other'},
              ]}
            />
            <output data-testid="kind">{kind}</output>
            <Dropdown
              label="Actions"
              align="start"
              header={{icon: 'tune', label: 'Actions'}}
              items={[
                {key: 'edit', icon: 'edit', label: 'Edit', onSelect: () => setKind('guild')},
                {key: 'close', icon: 'lock', label: 'Close', onSelect: () => setKind('user')},
                {key: 'off', icon: 'block', label: 'Unavailable', disabled: true, onSelect: () => {}},
                {
                  key: 'delete',
                  icon: 'delete',
                  label: 'Delete',
                  destructive: true,
                  separated: true,
                  onSelect: () => setKind('other'),
                },
              ]}
              trigger={({ref, onActivate, ...aria}) => (
                <md-outlined-button {...aria} ref={ref} trailing-icon onclick={onActivate}>
                  Dropdown menu
                  <md-icon slot="icon">expand_more</md-icon>
                </md-outlined-button>
              )}
            />
            <button type="button" data-testid="set-kind" onClick={() => setKind('other')}>
              set kind other
            </button>
            <button type="button" data-testid="set-text" onClick={() => setText('From state')}>
              set text
            </button>
            <Switch checked={on} onCheckedChange={setOn} label="Open to work" />
            <output data-testid="on">{String(on)}</output>
            <Checkbox checked={checked} onCheckedChange={setChecked} label="I accept" />
            <output data-testid="checked">{String(checked)}</output>
          </CardVisual>
        </Card>

        <Card span={6}>
          <h2>Dialogs, snackbar, loading</h2>
          <CardVisual>
            <Spinner />
          </CardVisual>
          <CardActions>
            <md-filled-button onclick={() => setDialog(true)}>Dialog</md-filled-button>
            <md-outlined-button onclick={() => setConfirm(true)}>Confirm</md-outlined-button>
            <md-outlined-button onclick={() => setDestructive(true)}>Delete</md-outlined-button>
            <md-filled-tonal-button onclick={() => snackbar.show({message: 'Post saved.'})}>
              Snackbar
            </md-filled-tonal-button>
            <md-text-button
              onclick={() =>
                snackbar.show({
                  message: 'Experience deleted. A longer message wraps on two lines when it needs to.',
                  action: {label: 'Undo', onClick: () => snackbar.show({message: 'Restored.'})},
                })
              }
            >
              With action
            </md-text-button>
          </CardActions>
        </Card>

        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          headline="A dialog"
          actions={<md-text-button onclick={() => setDialog(false)}>Close</md-text-button>}
        >
          Content of the dialog.
        </Dialog>
        <ConfirmDialog
          open={confirm}
          title="Publish this post?"
          body="It becomes visible to everyone."
          confirmLabel="Publish"
          onCancel={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
        />
        <ConfirmDialog
          open={destructive}
          title="Delete this post?"
          body="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setDestructive(false)}
          onConfirm={() => setDestructive(false)}
        />
        <DomainGallery />
        <FoundationGallery />
      </Bento>
    </Page>
  );
}
