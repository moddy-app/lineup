/**
 * The signed-in user's avatar in the app bar, and their menu.
 *
 *   <moddy-user-menu .user=${{handle: 'mia', email: 'mia@…', avatar: '…',
 *                             verified: 'Verified account', max: true}}>
 *     <md-menu-item href="/settings">
 *       <md-icon slot="start">settings</md-icon>
 *       <div slot="headline">Settings</div>
 *     </md-menu-item>
 *   </moddy-user-menu>
 *
 * The menu shows a card with the user (name or @handle, a verified badge
 * whose kind is in its tooltip, the email), the items you put inside the
 * element, a divider, and "Sign out", which fires `sign-out`.
 *
 * `max` draws the Moddy Max ring around the app bar avatar (only there, not
 * in the menu), outside the picture: the avatar keeps its 32px. The ring
 * takes the avatar's main hue when the picture's host allows CORS (Discord's
 * CDN does), the theme colors otherwise.
 */

import '@material/web/divider/divider.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/menu/menu-item.js';
import '@material/web/menu/menu.js';

import type {MdMenu} from '@material/web/menu/menu.js';
import {css, html, LitElement, nothing} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';

import {USER_MENU_LABELS, type UserMenuLabels} from '../labels.js';
import {dominantHue} from '../utils/main-color.js';

export interface ModdyUser {
  /** The handle, shown as @handle. */
  handle: string;
  /** A display name, shown instead of the handle when given. */
  name?: string;
  email?: string;
  avatar: string;
  /** The kind of verification ("Verified account"…), shown in the badge's
   *  tooltip. No badge when empty. */
  verified?: string;
  /** Moddy Max: a ring around the app bar avatar. */
  max?: boolean;
}

@customElement('moddy-user-menu')
export class ModdyUserMenu extends LitElement {
  @property({type: Object}) user: ModdyUser | null = null;

  @property({type: Object}) labels: Partial<UserMenuLabels> = {};

  @query('md-menu') private menu!: MdMenu;

  /** The Max ring's colors, from the avatar. */
  @state() private ring: [string, string] | null = null;

  private get text(): UserMenuLabels {
    return {...USER_MENU_LABELS, ...this.labels};
  }

  render() {
    const user = this.user;
    if (!user) return nothing;
    const title = user.name ?? `@${user.handle}`;
    const subtitle = user.email ?? (user.name ? `@${user.handle}` : '');
    return html`
      <md-icon-button id="button" aria-label=${this.text.userMenu} title=${title} @click=${this.toggle}>
        <span
          class="ring ${user.max ? 'max' : ''}"
          style=${this.ring ? `--ring-a: ${this.ring[0]}; --ring-b: ${this.ring[1]}` : ''}>
          <img src=${user.avatar} alt="" />
        </span>
      </md-icon-button>
      <md-menu
        anchor="button"
        positioning="fixed"
        menu-corner="start-end"
        anchor-corner="end-end"
        y-offset="8"
        default-focus="none">
        <div class="user-card">
          <img src=${user.avatar} alt="" />
          <div class="user-text">
            <span class="user-name">
              <span class="ellipsis">${title}</span>
              ${user.verified
                ? html`<span class="verified" tabindex="0" role="img" aria-label=${user.verified}>
                    <md-icon>check_circle</md-icon>
                    <span class="tooltip" aria-hidden="true">${user.verified}</span>
                  </span>`
                : nothing}
            </span>
            ${subtitle ? html`<span class="user-email ellipsis">${subtitle}</span>` : nothing}
          </div>
        </div>
        <slot></slot>
        <md-divider role="separator" tabindex="-1"></md-divider>
        <md-menu-item class="sign-out" @click=${this.signOut}>
          <md-icon slot="start">logout</md-icon>
          <div slot="headline">${this.text.signOut}</div>
        </md-menu-item>
      </md-menu>
    `;
  }

  private toggle() {
    this.menu.open = !this.menu.open;
  }

  private signOut() {
    this.dispatchEvent(new Event('sign-out', {bubbles: true, composed: true}));
  }

  protected willUpdate(changed: Map<string, unknown>) {
    const old = changed.get('user') as ModdyUser | null | undefined;
    if (changed.has('user') && (old?.avatar !== this.user?.avatar || old?.max !== this.user?.max)) {
      this.tintRing();
    }
  }

  /** The Max ring in the avatar's main hue, a vivid and a light shade. The
   *  picture is read from a separate CORS request, so a host without CORS
   *  only loses the tint, never the avatar. */
  private tintRing() {
    this.ring = null;
    const user = this.user;
    if (!user?.max) return;
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = () => {
      const hue = dominantHue(probe);
      if (hue === null || this.user?.avatar !== user.avatar) return;
      this.ring = [`hsl(${hue} 70% 48%)`, `hsl(${(hue + 25) % 360} 75% 66%)`];
    };
    probe.src = user.avatar;
  }

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
    }

    md-icon-button {
      --md-icon-button-icon-size: 32px;
    }

    md-menu {
      min-width: 272px;
    }

    md-menu-item,
    ::slotted(md-menu-item) {
      margin-inline: 8px;
      border-radius: 16px;
      overflow: hidden;
    }

    md-icon,
    ::slotted(md-menu-item) {
      font-variation-settings: 'FILL' 1;
    }

    .sign-out {
      --md-menu-item-label-text-color: var(--md-sys-color-error);
      --md-menu-item-leading-icon-color: var(--md-sys-color-error);
      --md-menu-item-hover-state-layer-color: var(--md-sys-color-error);
      --md-menu-item-pressed-state-layer-color: var(--md-sys-color-error);
    }

    md-divider {
      width: auto;
      margin: 8px 16px;
    }

    .user-card {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0 8px 8px;
      padding: 12px;
      border-radius: 16px;
      background-color: var(--md-sys-color-surface-container);
    }

    .user-card img {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      object-fit: cover;
    }

    .user-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .user-name {
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--md-sys-color-on-surface);
    }

    .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-email {
      font-size: 13px;
      color: var(--md-sys-color-on-surface-variant);
    }

    .verified {
      position: relative;
      display: inline-flex;
      flex-shrink: 0;
      border-radius: 50%;
      outline: none;
    }

    .verified md-icon {
      --md-icon-size: 16px;
      display: block;
      /* Sits on the name's x-height rather than its full line box. */
      transform: translateY(1px);
      color: var(--md-sys-color-primary);
    }

    .tooltip {
      position: absolute;
      top: calc(100% + 6px);
      left: 50%;
      z-index: 1;
      padding: 4px 8px;
      border-radius: 4px;
      background-color: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transform: translateX(-50%);
    }

    .verified:hover .tooltip,
    .verified:focus-visible .tooltip {
      opacity: 1;
    }

    @media (prefers-reduced-motion: no-preference) {
      .tooltip {
        transition: opacity 120ms;
      }
    }

    .ring {
      position: relative;
      display: block;
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }

    .ring img {
      display: block;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }

    /* Moddy Max: 3px wide, 2px away from the picture (radius 16 → gap to
       18 → ring to 21), a masked pseudo-element so nothing moves. */
    .ring.max::before {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      background: conic-gradient(
        from 200deg,
        var(--ring-a, var(--md-sys-color-primary)),
        var(--ring-b, var(--md-sys-color-tertiary)) 40%,
        color-mix(in srgb, var(--ring-a, var(--md-sys-color-primary)) 30%, var(--md-sys-color-surface-container)) 75%,
        var(--ring-a, var(--md-sys-color-primary))
      );
      -webkit-mask: radial-gradient(circle, transparent 17.5px, #000 18px);
      mask: radial-gradient(circle, transparent 17.5px, #000 18px);
      pointer-events: none;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'moddy-user-menu': ModdyUserMenu;
  }
}
