import {afterEach, describe, expect, it, vi} from 'vitest';

import {detectLanguage} from './detect';

function browserLanguages(languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('detectLanguage', () => {
  it('prefers ?lang=, keeps it for next time and removes it from the URL', () => {
    window.history.replaceState(null, '', '/guilds?lang=es&q=mod');
    localStorage.setItem('lineup-lang', 'de');
    browserLanguages(['fr-FR']);
    expect(detectLanguage()).toBe('es');
    expect(localStorage.getItem('lineup-lang')).toBe('es');
    expect(window.location.pathname + window.location.search).toBe('/guilds?q=mod');
  });

  it('then the stored choice', () => {
    localStorage.setItem('lineup-lang', 'de');
    browserLanguages(['fr-FR']);
    expect(detectLanguage()).toBe('de');
  });

  it('then the browser languages in order, skipping the unsupported', () => {
    browserLanguages(['ja-JP', 'pt-PT', 'en-US']);
    expect(detectLanguage()).toBe('pt-BR');
  });

  it('ignores an unknown ?lang= and a corrupt stored value', () => {
    window.history.replaceState(null, '', '/?lang=xx');
    localStorage.setItem('lineup-lang', 'klingon');
    browserLanguages(['fr']);
    expect(detectLanguage()).toBe('fr');
  });

  it('defaults to English', () => {
    browserLanguages(['ja', 'zh-CN']);
    expect(detectLanguage()).toBe('en');
  });
});
