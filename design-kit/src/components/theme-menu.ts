/**
 * The theme menu: a palette button that opens the theme panel.
 *
 *   <moddy-theme-menu labels='{"title":"Thème",…}'></moddy-theme-menu>
 *
 * The panel keeps every piece of the moddy.app theme menu: the seeds as
 * round swatches (the picked one turns into a rounded square with a check)
 * after a "random on every visit" swatch, a custom color (color picker,
 * hex value, HCT sliders), and the color mode as three segments.
 */

import '@material/web/focus/md-focus-ring.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/menu/menu.js';
import './hct-slider.js';

import type {MdMenu} from '@material/web/menu/menu.js';
import {css, html, LitElement} from 'lit';
import {customElement, property, query, queryAll, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {live} from 'lit/directives/live.js';

import {THEME_LABELS, type ThemeLabels} from '../labels.js';
import {hctFromHex, hexFromHct} from '../theme/scheme.js';
import {SEEDS} from '../theme/seeds.js';
import {type ColorMode, getThemeState, setMode, setSeed, shuffleSeed} from '../theme/theme.js';

import type {HCTSlider} from './hct-slider.js';

@customElement('moddy-theme-menu')
export class ModdyThemeMenu extends LitElement {
  @property({type: Object}) labels: Partial<ThemeLabels> = {};

  /** The seeds offered as swatches. */
  @property({type: Array}) seeds: string[] = SEEDS;

  @query('md-menu') private menu!: MdMenu;

  render() {
    const title = {...THEME_LABELS, ...this.labels}.title;
    return html`
      <md-icon-button id="button" title=${title} aria-label=${title} @click=${this.toggle}>
        <md-icon>palette</md-icon>
      </md-icon-button>
      <md-menu
        anchor="button"
        positioning="fixed"
        menu-corner="start-end"
        anchor-corner="end-end"
        y-offset="8"
        default-focus="none"
        role="dialog"
        aria-label=${title}>
        <moddy-theme-panel .labels=${this.labels} .seeds=${this.seeds}></moddy-theme-panel>
      </md-menu>
    `;
  }

  private toggle() {
    this.menu.open = !this.menu.open;
  }

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
    }

    md-icon-button {
      --md-icon-button-icon-color: var(--md-sys-color-on-surface-variant);
    }

    md-icon {
      font-variation-settings: 'FILL' 1;
    }
  `;
}

@customElement('moddy-theme-panel')
export class ModdyThemePanel extends LitElement {
  static override shadowRootOptions = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  @property({type: Object}) labels: Partial<ThemeLabels> = {};

  @property({type: Array}) seeds: string[] = SEEDS;

  @state() private mode: ColorMode = 'auto';
  @state() private hex = '';
  @state() private hue = 0;
  @state() private chroma = 0;
  @state() private tone = 0;
  /** The color was picked by hand (else: random on every visit). */
  @state() private locked = false;

  @query('input') private input!: HTMLInputElement;
  @queryAll('moddy-hct-slider') private sliders!: NodeListOf<HCTSlider>;

  private get text(): ThemeLabels {
    return {...THEME_LABELS, ...this.labels};
  }

  connectedCallback() {
    super.connectedCallback();
    const {seed, mode, locked} = getThemeState();
    this.mode = mode;
    this.locked = locked;
    this.showColor(seed);
  }

  render() {
    return html`
      <h2>${this.text.title}</h2>
      ${this.renderSwatches()} ${this.renderCustom()} ${this.renderModes()}
    `;
  }

  private renderSwatches() {
    const current = this.hex.toLowerCase();
    return html`<section>
      <h3 id="colors-label">${this.text.colors}</h3>
      <div class="swatches" role="radiogroup" aria-labelledby="colors-label">
        <button
          class=${classMap({swatch: true, random: true, selected: !this.locked})}
          role="radio"
          aria-checked=${this.locked ? 'false' : 'true'}
          aria-label=${`${this.text.random}: ${this.text.randomTitle}`}
          title=${this.text.randomTitle}
          @click=${this.pickRandom}>
          <md-icon aria-hidden="true">shuffle</md-icon>
        </button>
        ${this.seeds.map((seed) => {
          const selected = this.locked && seed.toLowerCase() === current;
          return html`<button
            class=${classMap({swatch: true, selected})}
            role="radio"
            aria-checked=${selected ? 'true' : 'false'}
            aria-label=${seed}
            title=${seed}
            style="--swatch: ${seed}"
            @click=${() => this.pick(seed)}>
            <md-icon aria-hidden="true">check</md-icon>
          </button>`;
        })}
      </div>
    </section>`;
  }

  private renderCustom() {
    return html`<section class="panel">
      <label id="hex" for="color-input">
        <span class="input-wrapper">
          <span class="overflow">
            <input
              id="color-input"
              type="color"
              aria-label=${this.text.source}
              .value=${live(this.hex)}
              @input=${() => this.pick(this.input.value)} />
          </span>
          <md-focus-ring for="color-input"></md-focus-ring>
        </span>
        <span class="hex-text">
          <span class="label">${this.text.custom}</span>
          <code>${this.hex.toUpperCase()}</code>
        </span>
        <md-icon aria-hidden="true">colorize</md-icon>
      </label>
      <div class="sliders">
        <moddy-hct-slider
          type="hue"
          label=${this.text.hue}
          .value=${live(this.hue)}
          @input=${this.onSlider}></moddy-hct-slider>
        <moddy-hct-slider
          type="chroma"
          label=${this.text.chroma}
          .value=${live(this.chroma)}
          .color=${this.hex}
          @input=${this.onSlider}></moddy-hct-slider>
        <moddy-hct-slider
          type="tone"
          label=${this.text.tone}
          .value=${live(this.tone)}
          @input=${this.onSlider}></moddy-hct-slider>
      </div>
    </section>`;
  }

  private renderModes() {
    const modes: Array<[ColorMode, string, string]> = [
      ['dark', 'dark_mode', this.text.dark],
      ['auto', 'brightness_medium', this.text.autoShort],
      ['light', 'light_mode', this.text.light],
    ];
    return html`<div class="modes" role="radiogroup" aria-label=${this.text.mode}>
      ${modes.map(([mode, icon, label]) => {
        const selected = this.mode === mode;
        return html`<button
          class=${classMap({selected})}
          role="radio"
          aria-checked=${selected ? 'true' : 'false'}
          title=${this.text[mode]}
          @click=${() => this.pickMode(mode)}>
          <md-icon aria-hidden="true">${icon}</md-icon>
          <span>${label}</span>
        </button>`;
      })}
    </div>`;
  }

  /** Shows a color in the hex field and the sliders. */
  private showColor(hex: string) {
    const hct = hctFromHex(hex);
    this.hex = hex;
    this.hue = hct.hue;
    this.chroma = hct.chroma;
    this.tone = hct.tone;
  }

  /** A color picked by hand: applied and kept on the next visits. */
  private pick(hex: string) {
    this.showColor(hex);
    this.locked = true;
    setSeed(hex);
  }

  private pickRandom() {
    this.showColor(shuffleSeed(this.seeds));
    this.locked = false;
  }

  private onSlider() {
    for (const slider of this.sliders) {
      this[slider.type] = slider.value;
    }
    this.hex = hexFromHct(this.hue, this.chroma, this.tone);
    this.locked = true;
    setSeed(this.hex);
  }

  private pickMode(mode: ColorMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    setMode(mode);
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-sizing: border-box;
      width: 320px;
      max-width: calc(100vw - 32px);
      padding: 8px 20px 20px;
      color: var(--md-sys-color-on-surface);
    }

    h2 {
      display: flex;
      align-items: center;
      min-height: 40px;
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    h3 {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--md-sys-color-on-surface-variant);
    }

    /* ---- Swatches --------------------------------------------------------- */

    .swatches {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
    }

    .swatch {
      position: relative;
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      width: 100%;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background-color: var(--swatch);
      /* On a seed swatch, white reads on every seed. */
      color: white;
      cursor: pointer;
      outline: none;
    }

    /* The picked color turns into a rounded square, with a check. */
    .swatch.selected {
      border-radius: 30%;
    }

    .swatch md-icon {
      --md-icon-size: 20px;
      opacity: 0;
      font-variation-settings: 'FILL' 1, 'wght' 600;
    }

    .swatch.selected md-icon,
    .swatch.random md-icon {
      opacity: 1;
    }

    .swatch:focus-visible {
      box-shadow:
        0 0 0 2px var(--md-sys-color-surface-container-lowest),
        0 0 0 4px var(--md-sys-color-secondary);
    }

    .swatch.random {
      background-color: var(--md-sys-color-surface-container-high);
      color: var(--md-sys-color-on-surface-variant);
    }

    .swatch.random.selected {
      background-color: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
    }

    @media (hover: hover) {
      .swatch:not(.selected):hover {
        border-radius: 38%;
      }
    }

    /* ---- Custom color ----------------------------------------------------- */

    .panel {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 12px 16px;
      border-radius: 20px;
      background-color: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface-variant);
      --md-slider-inactive-track-color: var(--md-sys-color-outline-variant);
    }

    #hex {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px;
      border-radius: 14px;
      cursor: pointer;
    }

    #hex > md-icon {
      --md-icon-size: 20px;
      margin-inline-end: 4px;
    }

    .hex-text {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      gap: 2px;
      min-width: 0;
    }

    .hex-text .label {
      font-size: 14px;
      font-weight: 600;
      color: var(--md-sys-color-on-surface);
    }

    .hex-text code {
      font-family: 'Google Sans Mono', monospace;
      font-size: 13px;
    }

    .input-wrapper {
      position: relative;
      flex-shrink: 0;
      box-sizing: border-box;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px var(--md-sys-color-outline-variant);
    }

    .input-wrapper md-focus-ring {
      border-radius: 50%;
    }

    .overflow {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: inherit;
    }

    input {
      min-width: 200%;
      min-height: 200%;
      border: none;
      background: none;
      cursor: pointer;
    }

    .sliders {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding-top: 8px;
    }

    /* ---- Color mode ------------------------------------------------------- */

    .modes {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
      padding: 4px;
      border-radius: 999px;
      background-color: var(--md-sys-color-surface-container);
    }

    .modes button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-width: 0;
      height: 40px;
      padding: 0 4px;
      border: 0;
      border-radius: 999px;
      background: none;
      color: var(--md-sys-color-on-surface-variant);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      outline: none;
    }

    .modes button md-icon {
      --md-icon-size: 18px;
      flex-shrink: 0;
    }

    .modes button span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .modes button.selected {
      background-color: var(--md-sys-color-surface-container-lowest);
      color: var(--md-sys-color-on-surface);
      box-shadow: 0 1px 2px color-mix(in srgb, var(--md-sys-color-shadow) 18%, transparent);
    }

    .modes button.selected md-icon {
      font-variation-settings: 'FILL' 1;
      color: var(--md-sys-color-primary);
    }

    .modes button:focus-visible {
      box-shadow: 0 0 0 2px var(--md-sys-color-secondary);
    }

    @media (hover: hover) {
      .modes button:not(.selected):hover {
        color: var(--md-sys-color-on-surface);
      }
    }

    @media (prefers-reduced-motion: no-preference) {
      .swatch {
        transition: border-radius 200ms cubic-bezier(0.2, 0, 0, 1);
      }

      .swatch md-icon {
        transition: opacity 150ms;
      }

      .modes button {
        transition:
          background-color 200ms cubic-bezier(0.2, 0, 0, 1),
          color 200ms cubic-bezier(0.2, 0, 0, 1);
      }
    }

    @media (forced-colors: active) {
      .panel,
      .swatch {
        box-sizing: border-box;
        border: 1px solid CanvasText;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'moddy-theme-menu': ModdyThemeMenu;
    'moddy-theme-panel': ModdyThemePanel;
  }
}
