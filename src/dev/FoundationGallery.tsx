/**
 * Development only: the components of the UI redesign (docs/ui-redesign.md),
 * part of /__ui. Its strings are not translated (the components' own are).
 */

import {useQueryClient} from '@tanstack/react-query';
import {useEffect, useState} from 'react';

import {catalogFixture} from '@/api/catalog.fixture';
import {queryKeys} from '@/api/queryKeys';
import type {Badge} from '@/api/types';
import {
  BadgeStrip,
  DisplayName,
  FilterBar,
  type FilterDefinition,
  InlineStats,
  TagLabel,
  LanguageFlags,
  Markdown,
  VerifiedBadge,
} from '@/components';
import {Avatar, Card, CardVisual, PageHeader, SettingsLayout, SettingsPanel, ShowcasePage} from '@/ui';

const badge = (id: string): Badge => {
  const entry = catalogFixture.badges.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown badge ${id}`);
  return {id: entry.id, label: entry.label, source: entry.source};
};

const MARKDOWN = `# A big title in the source
Some **bold**, *italic* and \`inline code\` text with a [link](https://moddy.app) and a bad [link](javascript:alert(1)).

## Another heading
- first point
- second point

> A quote from someone.

![An image is not loaded](https://example.com/a.png)

<script>alert(1)</script>`;

const POSITIONS = catalogFixture.positions.map((entry) => ({value: entry.id, label: entry.label.en}));
const LANGUAGES = catalogFixture.languages.map((entry) => ({value: entry.id, label: entry.label.en}));
const THEMES = catalogFixture.themes.map((entry) => ({value: entry.id, label: entry.label.en}));

export function FoundationGallery() {
  const queryClient = useQueryClient();
  // The labels of badges and languages come from the catalog.
  useEffect(() => {
    if (!queryClient.getQueryData(queryKeys.catalog())) queryClient.setQueryData(queryKeys.catalog(), catalogFixture);
  }, [queryClient]);

  const [search, setSearch] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['fr']);
  const [themes, setThemes] = useState<string[]>([]);
  const filters: Record<'position' | 'language' | 'theme', FilterDefinition> = {
    position: {
      icon: 'work',
      label: 'Position',
      kind: 'multi',
      options: POSITIONS,
      value: positions,
      onChange: setPositions,
    },
    language: {
      icon: 'translate',
      label: 'Language',
      kind: 'single',
      options: LANGUAGES,
      value: languages,
      onChange: setLanguages,
    },
    theme: {icon: 'palette', label: 'Theme', kind: 'multi', options: THEMES, value: themes, onChange: setThemes},
  };

  return (
    <>
      <Card>
        <h2>Verification and names</h2>
        <p>DisplayName with the three marks, a long name that is cut, and no mark when the badges are missing.</p>
        <CardVisual>
          <div className="gallery-stack">
            <DisplayName as="strong" entity="user" name="Noé (Moddy team)" badges={[badge('moddy_staff')]} />
            <DisplayName as="strong" entity="guild" name="Moddy (official server)" badges={[badge('moddy_server')]} />
            <DisplayName
              as="strong"
              entity="guild"
              name="Cubelands (verified server)"
              badges={[badge('lineup_verified')]}
            />
            <DisplayName as="strong" entity="user" name="Alex (verified account)" badges={[badge('lineup_verified')]} />
            <DisplayName
              as="strong"
              entity="guild"
              name="A server with a very long name that cannot fit on one line of a phone"
              badges={[badge('lineup_verified')]}
            />
            <DisplayName as="strong" entity="user" name="Camille (no badges)" />
            <VerifiedBadge kind="moddy_staff" entity="user" />
          </div>
        </CardVisual>
      </Card>

      <Card>
        <h2>Badge strip, flags, inline stats</h2>
        <p>
          BadgeStrip leaves out Discord badges and keeps the verification ones. InlineStats are metadata, not figures.
        </p>
        <CardVisual>
          <div className="gallery-stack">
            <BadgeStrip
              badges={[
                badge('discord_verified'),
                badge('moddy_installed'),
                badge('moddy_premium'),
                badge('moddy_partner'),
                badge('nsfw'),
                badge('lineup_verified'),
              ]}
            />
            <LanguageFlags
              codes={['fr', 'en', 'es', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'tr', 'xx']}
            />
            <div className="gallery-row">
              <TagLabel>minecraft</TagLabel>
              <TagLabel>survie</TagLabel>
              <TagLabel icon="category">Jeux vidéo</TagLabel>
            </div>
            <InlineStats
              items={[
                {icon: 'group', value: 12850, label: 'members'},
                {icon: 'bolt', value: null, label: 'boosts'},
                {icon: 'schedule', value: 'Europe/Paris', label: 'time zone'},
              ]}
            />
          </div>
        </CardVisual>
      </Card>

      <Card>
        <h2>Markdown</h2>
        <p>Safe rendering of a person’s text: no HTML, small headings, safe links, no images.</p>
        <CardVisual>
          <Markdown>{MARKDOWN}</Markdown>
        </CardVisual>
      </Card>

      <div className="gallery-on-page">
        <h2>Filter bar</h2>
        <FilterBar
          search={{value: search, onChange: setSearch, placeholder: 'Search posts'}}
          filters={filters}
          trailing={
            <md-icon-button aria-label="Sort" title="Sort">
              <md-icon>sort</md-icon>
            </md-icon-button>
          }
        />
      </div>

      <div className="gallery-on-page">
        <h2>Showcase header</h2>
        <ShowcasePage>
          <PageHeader
            leading={<Avatar src="/design-kit/assets/avatars/leo.webp" size="xl" />}
            title={<DisplayName entity="guild" name="Cubelands" badges={[badge('lineup_verified')]} />}
            subtitle="A game development community."
            meta={<InlineStats items={[{icon: 'group', value: 2700, label: 'members'}]} />}
            actions={
              <>
                <md-outlined-button>Report</md-outlined-button>
                <md-filled-button>Join</md-filled-button>
              </>
            }
          />
        </ShowcasePage>
      </div>

      <div className="gallery-on-page">
        <h2>Settings layout</h2>
        <SettingsLayout
          title="Profile"
          description="What servers see when they recruit."
          actions={<md-outlined-button>View public profile</md-outlined-button>}
        >
          <SettingsPanel
            title="Headline"
            description="One line under your name."
            actions={<md-filled-button>Save</md-filled-button>}
          >
            <p>Fields go here.</p>
          </SettingsPanel>
          <SettingsPanel title="Danger zone" actions={<md-outlined-button>Delete</md-outlined-button>}>
            <p>A second panel.</p>
          </SettingsPanel>
        </SettingsLayout>
      </div>
    </>
  );
}
