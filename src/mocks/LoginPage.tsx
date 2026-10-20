/**
 * The mock's sign-in page, at `/__mock/login?redirect=<path>`. It stands in
 * for Discord's authorization screen (LINEUP.md §2): pick who you are and you
 * come back to the page you left; "Deny" comes back with
 * `?auth_error=access_denied` and no session.
 *
 * Development only (English text on purpose, clearly marked).
 */

import {useEffect} from 'react';

import {sanitizeRedirect} from '@/api/endpoints';
import {Shape, type ShapeName, type ShapeTone} from '@/ui';

import './mocks.css';
import {PERSONAS, setPersonaId, type PersonaId} from './personas';

/** One shape and tone per persona, varied between neighbours (design system, section 6). */
const LOOK: Record<PersonaId, {icon: string; shape: ShapeName; tone: ShapeTone}> = {
  anonymous: {icon: 'person_off', shape: 'square', tone: 'primary'},
  member: {icon: 'person', shape: 'hexagon', tone: 'primary'},
  dashboard: {icon: 'dashboard', shape: 'diamond', tone: 'secondary'},
  staff: {icon: 'shield_person', shape: 'octagon', tone: 'tertiary'},
  suspended: {icon: 'block', shape: 'pentagon', tone: 'secondary'},
  newcomer: {icon: 'waving_hand', shape: 'heptagon', tone: 'tertiary'},
};

function destination(search: string): {path: string; reauth: boolean} {
  const params = new URLSearchParams(search);
  let path = sanitizeRedirect(params.get('redirect') ?? '/');
  // The real API would send an absolute moddy.app URL to the production site; the mock stays on this origin.
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    path = url.pathname + url.search + url.hash;
  }
  return {path, reauth: params.get('reauth') === '1'};
}

/** The destination with `auth_error=access_denied` added, every other parameter kept. */
function declined(path: string): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('auth_error', 'access_denied');
  return url.pathname + url.search + url.hash;
}

export function MockLoginPage({navigate = (url) => window.location.assign(url)}: {navigate?: (url: string) => void}) {
  const {path, reauth} = destination(window.location.search);
  useEffect(() => {
    document.title = 'Mock sign-in';
  }, []);

  const choose = (id: PersonaId) => {
    setPersonaId(id);
    navigate(path);
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
                      <Shape
                        small
                        shape={LOOK[persona.id].shape}
                        tone={LOOK[persona.id].tone}
                        icon={LOOK[persona.id].icon}
                      />
                      <span className="row-body">
                        <span className="row-title">{persona.label}</span>
                        <span className="row-meta">{persona.description}</span>
                        <span className="status">
                          {persona.session?.hasLineupScopes ? 'Lineup scopes' : 'No Lineup scopes'}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="card-actions">
                <md-outlined-button
                  onclick={() => {
                    navigate(declined(path));
                  }}
                >
                  Deny (access_denied)
                </md-outlined-button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
