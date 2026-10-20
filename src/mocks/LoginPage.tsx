/**
 * The mock's sign-in page, at `/__mock/login?redirect=<path>`. It stands in
 * for Discord's authorization screen (LINEUP.md §2): pick who you are and you
 * come back to the page you left; "Refuser" comes back with
 * `?auth_error=access_denied` and no session.
 *
 * Development only (English text on purpose, clearly marked).
 */

import {useEffect} from 'react';

import {sanitizeRedirect} from '@/api/endpoints';

import './mocks.css';
import {PERSONAS, setPersonaId, type PersonaId} from './personas';

function destination(search: string): {path: string; reauth: boolean} {
  const params = new URLSearchParams(search);
  return {path: sanitizeRedirect(params.get('redirect') ?? '/'), reauth: params.get('reauth') === '1'};
}

/** The destination with `auth_error=access_denied` added, every other parameter kept. */
function declined(path: string): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('auth_error', 'access_denied');
  return url.pathname + url.search + url.hash;
}

export function MockLoginPage() {
  const {path, reauth} = destination(window.location.search);
  useEffect(() => {
    document.title = 'Mock sign-in';
  }, []);

  const choose = (id: PersonaId) => {
    setPersonaId(id);
    window.location.assign(path);
  };

  return (
    <div className="app mock-login">
      <main className="app-content" id="main-content">
        <div className="page special">
          <div className="bento">
            <section className="card hero">
              <span className="pill mock-banner">Development mock, not Discord</span>
              <h1>Sign in as…</h1>
              <p>
                This page replaces Discord&apos;s authorization screen while the backend is mocked. Pick a persona; you
                will be sent back to <code>{path}</code>.
              </p>
              {reauth && (
                <p role="status">
                  Lineup asked for a new authorization (<code>lineup_reauth_required</code>): choose a persona with
                  Lineup scopes, such as Member.
                </p>
              )}
            </section>
            <section className="card">
              <ul className="rows">
                {PERSONAS.filter((persona) => persona.id !== 'anonymous').map((persona) => (
                  <li key={persona.id}>
                    <a
                      className="row"
                      href={path}
                      onClick={(event) => {
                        event.preventDefault();
                        choose(persona.id);
                      }}
                    >
                      <span className="shape small">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {persona.id === 'staff' ? 'shield_person' : persona.id === 'suspended' ? 'block' : 'person'}
                        </span>
                      </span>
                      <span className="row-body">
                        <span className="row-title">{persona.label}</span>
                        <span className="row-meta">{persona.description}</span>
                      </span>
                      <span className="status">{persona.session?.hasLineupScopes ? 'Lineup scopes' : 'No scopes'}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="card-actions">
                <md-outlined-button
                  onclick={() => {
                    window.location.assign(declined(path));
                  }}
                >
                  Refuser (access_denied)
                </md-outlined-button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
