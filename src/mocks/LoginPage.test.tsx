import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {MockLoginPage} from './LoginPage';
import {getPersonaId} from './personas';

function renderAt(search: string) {
  window.history.pushState({}, '', `/__mock/login${search}`);
  const navigate = vi.fn();
  render(<MockLoginPage navigate={navigate} />);
  return navigate;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('the mock sign-in page', () => {
  it('offers every persona but anonymous, and says where you will go back to', () => {
    renderAt('?redirect=/guilds');
    for (const name of [
      'Member (Camille)',
      'Dashboard session (Camille)',
      'Staff (Noé)',
      'Suspended (Dylan)',
      'Newcomer (Inès)',
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.queryByText('Anonymous')).toBeNull();
    expect(screen.getByText('/guilds')).toBeTruthy();
  });

  it('signs in as the chosen persona and goes back to the page you left', () => {
    const navigate = renderAt('?redirect=%2Fposts%3Fkind%3Dguild%23top');
    fireEvent.click(screen.getByText('Staff (Noé)'));
    expect(getPersonaId()).toBe('staff');
    expect(navigate).toHaveBeenCalledWith('/posts?kind=guild#top');
  });

  it('"Refuser" goes back with ?auth_error=access_denied, keeps the other parameters, and signs nobody in', () => {
    window.localStorage.setItem('lineup-mock-persona', 'anonymous');
    const navigate = renderAt('?redirect=%2Fposts%3Fkind%3Dguild%26q%3Dmod');
    fireEvent.click(screen.getByText(/Refuser/));
    expect(navigate).toHaveBeenCalledWith('/posts?kind=guild&q=mod&auth_error=access_denied');
    expect(getPersonaId()).toBe('anonymous');
  });

  it('falls back to the home page for a hostile or missing destination, and stays on this origin', () => {
    for (const search of [
      '',
      '?redirect=https%3A%2F%2Fevil.example.com%2Fx',
      '?redirect=%2F%2Fevil.example.com',
      '?redirect=javascript%3Aalert(1)',
    ]) {
      document.body.innerHTML = '';
      const navigate = renderAt(search);
      fireEvent.click(screen.getByText('Member (Camille)'));
      expect(navigate, search).toHaveBeenCalledWith('/');
    }
    document.body.innerHTML = '';
    const navigate = renderAt('?redirect=https%3A%2F%2Flineup.moddy.app%2Fposts%2F1%3Fa%3D2');
    fireEvent.click(screen.getByText('Member (Camille)'));
    expect(navigate).toHaveBeenCalledWith('/posts/1?a=2');
  });

  it('explains a re-authorization (lineup_reauth_required) when asked to', () => {
    renderAt('?redirect=/me&reauth=1');
    expect(screen.getByRole('status').textContent).toContain('lineup_reauth_required');
  });
});
