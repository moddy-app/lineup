/**
 * The dev panel of the mock: a small button at the bottom left (collapsed by
 * default) that opens the controls: persona, latency, Discord outage, a
 * network failure, the verification outcome, reset. Development only (English
 * text on purpose). It lives in its own React root, outside the app, and is
 * made of the kit's Material Web parts (no home-made button).
 */

import {useState, useSyncExternalStore} from 'react';

import {Dialog, Select, Switch} from '@/ui';

import {resetDb} from './db';
import type {VerifyOutcome} from './env';
import {getPersonaId, PERSONAS, setPersonaId, subscribePersona, type PersonaId} from './personas';
import './mocks.css';
import {getSettings, subscribeSettings, updateSettings, type MockSettings} from './settings';

function useSettings(): MockSettings {
  return useSyncExternalStore(subscribeSettings, getSettings);
}

const LATENCIES = [
  {value: '0', label: '0 ms'},
  {value: '300', label: '300 ms'},
  {value: '1200', label: '1200 ms'},
] as const;

const OUTCOMES: ReadonlyArray<{value: VerifyOutcome; label: string}> = [
  {value: 'auto', label: 'From the data'},
  {value: 'success', label: 'Success'},
  {value: 'not_member', label: 'Not a member (not_member)'},
  {value: 'no_staff_permission', label: 'No staff permission (no_staff_permission)'},
];

const PERSONA_OPTIONS = PERSONAS.map((entry) => ({value: entry.id, label: entry.label}));

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const settings = useSettings();
  const persona = useSyncExternalStore(subscribePersona, getPersonaId);
  const current = PERSONAS.find((entry) => entry.id === persona);

  const choosePersona = (id: string) => {
    if (id === persona || !PERSONAS.some((entry) => entry.id === id)) return;
    setPersonaId(id as PersonaId);
    // The session is read again from scratch: simplest is a reload.
    window.location.reload();
  };

  return (
    <>
      <div className="mock-fab">
        <md-filled-tonal-button
          aria-expanded={open}
          aria-controls="mock-panel"
          onclick={() => setOpen((value) => !value)}
        >
          <span slot="icon" className="material-symbols-outlined" aria-hidden="true">
            science
          </span>
          Mock
        </md-filled-tonal-button>
      </div>
      {open && (
        <section className="mock-panel" id="mock-panel" aria-label="Mock API controls">
          <div className="mock-panel-head">
            <h2>Mock API</h2>
            <md-text-button onclick={() => setOpen(false)}>Close</md-text-button>
          </div>

          <div className="mock-section">
            <Select label="Persona" value={persona} options={PERSONA_OPTIONS} onValueChange={choosePersona} />
            <p className="mock-note">{current?.description}</p>
            <Select
              label="Latency (±40% jitter)"
              value={String(settings.latency)}
              options={LATENCIES}
              onValueChange={(latency) => updateSettings({latency: Number(latency) as MockSettings['latency']})}
            />
            <Select
              label="Outcome of the automatic verification"
              value={settings.verifyOutcome}
              options={OUTCOMES}
              onValueChange={(verifyOutcome) => updateSettings({verifyOutcome: verifyOutcome as VerifyOutcome})}
            />
          </div>

          <div className="mock-section">
            <h3>Failures</h3>
            <Switch
              checked={settings.discordDown}
              onCheckedChange={(discordDown) => updateSettings({discordDown})}
              label="Discord unavailable (503, Retry-After: 30)"
            />
            <p className="mock-note">
              Only the routes that call Discord: claim, invitations, verify, rights checks the session and the 5-minute
              server list cannot answer. Public reads serve old data with stale: true.
            </p>
            <md-outlined-button onclick={() => updateSettings({failNext: true})} disabled={settings.failNext}>
              {settings.failNext ? 'The next request will fail' : 'Fail the next request (network error)'}
            </md-outlined-button>
          </div>

          <div className="mock-section">
            <h3>Server</h3>
            <Switch
              checked={settings.feedCache}
              onCheckedChange={(feedCache) => updateSettings({feedCache})}
              label="Cache the feed for 60 s, like Redis"
            />
            <md-outlined-button onclick={() => setConfirmReset(true)}>Reset the database</md-outlined-button>
          </div>
        </section>
      )}
      <Dialog
        open={confirmReset}
        type="alert"
        onClose={() => setConfirmReset(false)}
        headline="Reset the mock database?"
        actions={
          <>
            <md-text-button onclick={() => setConfirmReset(false)}>Cancel</md-text-button>
            <md-filled-button
              onclick={() => {
                resetDb();
                window.location.reload();
              }}
            >
              Reset
            </md-filled-button>
          </>
        }
      >
        Every change you made is lost: the database goes back to the seed.
      </Dialog>
    </>
  );
}
