/**
 * The dev panel of the mock: a small button at the bottom left (collapsed by
 * default) that opens the controls — persona, latency, Discord outage, a
 * network failure, the verification outcome, reset. Development only (English
 * text on purpose). It lives in its own React root, outside the app.
 */

import {useState, useSyncExternalStore} from 'react';

import {Switch} from '@/ui';

import {resetDb} from './db';
import type {VerifyOutcome} from './env';
import {getPersonaId, PERSONAS, setPersonaId, type PersonaId} from './personas';
import './mocks.css';
import {getSettings, subscribeSettings, updateSettings, type MockSettings} from './settings';

function useSettings(): MockSettings {
  return useSyncExternalStore(subscribeSettings, getSettings);
}

interface ChoicesProps<T extends string | number> {
  label: string;
  value: T;
  options: ReadonlyArray<{value: T; label: string}>;
  onChange: (value: T) => void;
}

function Choices<T extends string | number>({label, value, options, onChange}: ChoicesProps<T>) {
  return (
    <div className="mock-choices" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="mock-choice"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const LATENCIES = [
  {value: 0, label: '0 ms'},
  {value: 300, label: '300 ms'},
  {value: 1200, label: '1200 ms'},
] as const;

const OUTCOMES: ReadonlyArray<{value: VerifyOutcome; label: string}> = [
  {value: 'auto', label: 'From the data'},
  {value: 'success', label: 'Success'},
  {value: 'not_member', label: 'Not a member'},
  {value: 'no_staff_permission', label: 'No staff permission'},
];

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const settings = useSettings();
  const persona = getPersonaId();
  const current = PERSONAS.find((entry) => entry.id === persona);

  const choosePersona = (id: PersonaId) => {
    if (id === persona) return;
    setPersonaId(id);
    // The session is read again from scratch: simplest is a reload.
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        className="mock-fab"
        aria-expanded={open}
        aria-controls="mock-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          science
        </span>
        MOCK
      </button>
      {open && (
        <section className="mock-panel" id="mock-panel" aria-label="Mock API controls">
          <div className="mock-panel-head">
            <h2>Mock API</h2>
            <md-text-button onclick={() => setOpen(false)}>Close</md-text-button>
          </div>

          <div className="mock-section">
            <h3>Persona</h3>
            <Choices
              label="Persona"
              value={persona}
              options={PERSONAS.map((entry) => ({value: entry.id, label: entry.label.split(' (')[0] ?? entry.label}))}
              onChange={choosePersona}
            />
            <p className="mock-note">{current?.description}</p>
          </div>

          <div className="mock-section">
            <h3>Latency</h3>
            <Choices
              label="Latency"
              value={settings.latency}
              options={LATENCIES}
              onChange={(latency) => updateSettings({latency})}
            />
            <p className="mock-note">Base delay of every answer, with ±40% of jitter.</p>
          </div>

          <div className="mock-section">
            <h3>Failures</h3>
            <Switch
              checked={settings.discordDown}
              onCheckedChange={(discordDown) => updateSettings({discordDown})}
              label="Discord unavailable (503, Retry-After: 30)"
            />
            <p className="mock-note">
              Claim, rights checks on writes, verify, my servers (stale). Public reads serve old data with stale: true.
            </p>
            <md-outlined-button onclick={() => updateSettings({failNext: true})} disabled={settings.failNext}>
              {settings.failNext ? 'The next request will fail' : 'Fail the next request (network error)'}
            </md-outlined-button>
          </div>

          <div className="mock-section">
            <h3>Automatic verification</h3>
            <Choices
              label="Automatic verification outcome"
              value={settings.verifyOutcome}
              options={OUTCOMES}
              onChange={(verifyOutcome) => updateSettings({verifyOutcome})}
            />
            <p className="mock-note">What POST …/verify returns for an experience on a server.</p>
          </div>

          <div className="mock-section">
            <h3>Server</h3>
            <Switch
              checked={settings.feedCache}
              onCheckedChange={(feedCache) => updateSettings({feedCache})}
              label="Cache the feed for 60 s, like Redis"
            />
            <md-outlined-button
              onclick={() => {
                if (!window.confirm('Reset the mock database to the seed? Your changes are lost.')) return;
                resetDb();
                window.location.reload();
              }}
            >
              Reset the database
            </md-outlined-button>
          </div>
        </section>
      )}
    </>
  );
}
