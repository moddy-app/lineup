/**
 * The app bar: the Moddy logo, the app's navigation and its actions, in the
 * page color, stuck to the top of the window.
 *
 *   <moddy-app-bar home-href="/" labels='{"home":"Accueil",…}'>
 *     <nav slot="nav" class="app-nav">…</nav>
 *     <moddy-theme-menu></moddy-theme-menu>
 *     <moddy-user-menu></moddy-user-menu>
 *   </moddy-app-bar>
 *
 * Slots: `logo` (replaces the Moddy logo), `nav`, and the default slot for
 * the actions on the right. The skip link leads to #main-content.
 */

import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {APP_BAR_LABELS, type AppBarLabels} from '../labels.js';
import {moddyLogo, moddyMark} from './logo.js';

@customElement('moddy-app-bar')
export class ModdyAppBar extends LitElement {
  /** Where the logo leads. */
  @property({attribute: 'home-href'}) homeHref = '/';

  @property({type: Object}) labels: Partial<AppBarLabels> = {};

  private get text(): AppBarLabels {
    return {...APP_BAR_LABELS, ...this.labels};
  }

  render() {
    return html`
      <header>
        <a id="skip" href="#main-content">${this.text.skipToMain}</a>
        <slot name="logo">
          <a class="logo" href=${this.homeHref} title=${this.text.home} aria-label=${this.text.home}>
            <span class="wordmark">${moddyLogo}</span><span class="mark">${moddyMark}</span>
          </a>
        </slot>
        <div class="nav"><slot name="nav"></slot></div>
        <div class="actions"><slot></slot></div>
      </header>
    `;
  }

  static styles = css`
    :host {
      position: sticky;
      top: 0;
      z-index: 10;
      display: block;
      height: var(--app-bar-height, 72px);
    }

    header {
      display: flex;
      align-items: center;
      gap: 16px;
      box-sizing: border-box;
      height: 100%;
      padding: 12px 16px;
      background-color: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
    }

    .logo {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      height: 36px;
      margin-top: -3px;
      color: var(--md-sys-color-primary);
      border-radius: 8px;
      outline: none;
    }

    .logo:focus-visible {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 4px;
    }

    .logo svg {
      display: block;
      height: 36px;
      width: auto;
    }

    .logo .mark {
      display: none;
    }

    .logo .mark svg {
      height: 24px;
    }

    .nav {
      display: flex;
      flex: 1;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .actions {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      gap: 4px;
    }

    #skip {
      position: absolute;
      left: 16px;
      z-index: 1;
      padding: 8px;
      border-radius: 12px;
      background-color: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
      font-size: 14px;
      text-decoration: none;
      opacity: 0;
      pointer-events: none;
    }

    #skip:focus-visible {
      opacity: 1;
      pointer-events: auto;
    }

    /* Narrow windows: the mark alone. */
    @media (max-width: 600px) {
      header {
        gap: 8px;
        padding-inline: 12px;
      }

      .logo {
        margin-top: 0;
        padding-inline: 4px;
      }

      .logo .wordmark {
        display: none;
      }

      .logo .mark {
        display: block;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'moddy-app-bar': ModdyAppBar;
  }
}
