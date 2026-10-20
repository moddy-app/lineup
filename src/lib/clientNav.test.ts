import {afterEach, describe, expect, it} from 'vitest';

import {internalAnchor} from './clientNav';

function click(href: string, init: MouseEventInit & {target?: string} = {}) {
  const anchor = document.createElement('a');
  anchor.href = href;
  if (init.target) anchor.target = init.target;
  document.body.append(anchor);
  let result: HTMLAnchorElement | null = null;
  anchor.addEventListener('click', (event) => {
    result = internalAnchor(event);
    event.preventDefault();
  });
  anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, composed: true, button: 0, ...init}));
  return result;
}

afterEach(() => document.body.replaceChildren());

describe('internalAnchor', () => {
  it('takes a plain click on a path of the app', () => {
    expect(click('/guilds')).not.toBeNull();
  });

  it('leaves other sites to the browser', () => {
    expect(click('https://moddy.app/')).toBeNull();
  });

  it('leaves modified clicks, other buttons and new tabs to the browser', () => {
    expect(click('/guilds', {ctrlKey: true})).toBeNull();
    expect(click('/guilds', {metaKey: true})).toBeNull();
    expect(click('/guilds', {shiftKey: true})).toBeNull();
    expect(click('/guilds', {button: 1})).toBeNull();
    expect(click('/guilds', {target: '_blank'})).toBeNull();
  });

  it('leaves in-page anchors (the skip link) to the browser', () => {
    expect(click('#main-content')).toBeNull();
  });
});
