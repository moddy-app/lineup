/**
 * JSX types for the custom elements the app uses: Material Web (md-*) and the
 * design kit (moddy-*).
 *
 * React 19 sets a prop as a PROPERTY when the element has it (value,
 * disabled, user, labels…) and as an attribute otherwise (home-href, slot,
 * class). Events are plain DOM events: an `on<event>` prop with the event's
 * exact, lowercase name becomes addEventListener('<event>') (oninput,
 * onchange, onclose, onsign-out). The camelCase React props (onChange…) do
 * NOT listen to a custom element's own events, hence the lowercase ones.
 *
 * The properties are taken from the element classes themselves, so a typo or
 * a Material Web change is a compile error.
 */

import type {MdCheckbox} from '@material/web/checkbox/checkbox.js';
import type {MdChipSet} from '@material/web/chips/chip-set.js';
import type {MdFilterChip} from '@material/web/chips/filter-chip.js';
import type {MdDialog} from '@material/web/dialog/dialog.js';
import type {MdDivider} from '@material/web/divider/divider.js';
import type {MdFocusRing} from '@material/web/focus/md-focus-ring.js';
import type {MdIcon} from '@material/web/icon/icon.js';
import type {MdIconButton} from '@material/web/iconbutton/icon-button.js';
import type {MdMenu} from '@material/web/menu/menu.js';
import type {MdMenuItem} from '@material/web/menu/menu-item.js';
import type {MdCircularProgress} from '@material/web/progress/circular-progress.js';
import type {MdLinearProgress} from '@material/web/progress/linear-progress.js';
import type {MdRadio} from '@material/web/radio/radio.js';
import type {MdRipple} from '@material/web/ripple/ripple.js';
import type {MdOutlinedSelect} from '@material/web/select/outlined-select.js';
import type {MdSelectOption} from '@material/web/select/select-option.js';
import type {MdSwitch} from '@material/web/switch/switch.js';
import type {MdPrimaryTab} from '@material/web/tabs/primary-tab.js';
import type {MdSecondaryTab} from '@material/web/tabs/secondary-tab.js';
import type {MdTabs} from '@material/web/tabs/tabs.js';
import type {MdOutlinedTextField} from '@material/web/textfield/outlined-text-field.js';
import type {ModdyAppBar, ModdyThemeMenu, ModdyUserMenu} from '@moddy/design-kit';
import type {MdFilledButton} from '@material/web/button/filled-button.js';
import type {MdFilledTonalButton} from '@material/web/button/filled-tonal-button.js';
import type {MdOutlinedButton} from '@material/web/button/outlined-button.js';
import type {MdTextButton} from '@material/web/button/text-button.js';
import type * as React from 'react';

/** A listener for one of the element's own events. */
type Listener<T extends HTMLElement, E extends Event = Event> = (
  event: E & {currentTarget: T; target: EventTarget | null},
) => void;

/** The events the app listens to, by their DOM name. */
interface ElementEvents<T extends HTMLElement> {
  onclick?: Listener<T, MouseEvent>;
  oninput?: Listener<T>;
  onchange?: Listener<T>;
  /** md-dialog and md-menu: closing starts / finished. */
  onclose?: Listener<T>;
  onclosed?: Listener<T>;
  onopen?: Listener<T>;
  onopened?: Listener<T>;
  /** md-dialog: Escape or scrim click; preventDefault keeps it open. */
  oncancel?: Listener<T>;
}

type Props<T extends HTMLElement, K extends keyof T = never, Extra = unknown> = Omit<
  React.DetailedHTMLProps<React.HTMLAttributes<T>, T>,
  'children'
> &
  ElementEvents<T> &
  Partial<Pick<T, K>> &
  Extra & {children?: React.ReactNode};

type ButtonKeys =
  'disabled' | 'href' | 'target' | 'type' | 'name' | 'value' | 'softDisabled' | 'trailingIcon' | 'hasIcon';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // Buttons
      'md-filled-button': Props<MdFilledButton, ButtonKeys>;
      'md-filled-tonal-button': Props<MdFilledTonalButton, ButtonKeys>;
      'md-outlined-button': Props<MdOutlinedButton, ButtonKeys>;
      'md-text-button': Props<MdTextButton, ButtonKeys>;
      'md-icon-button': Props<
        MdIconButton,
        'disabled' | 'href' | 'target' | 'type' | 'name' | 'value' | 'selected' | 'toggle' | 'flipIconInRtl'
      > & {'aria-label'?: string};

      // Icons, dividers, effects
      'md-icon': Props<MdIcon>;
      'md-divider': Props<MdDivider, 'inset' | 'insetStart' | 'insetEnd'>;
      'md-ripple': Props<MdRipple, 'disabled'>;
      'md-focus-ring': Props<MdFocusRing, 'visible' | 'inward'>;

      // Menus
      'md-menu': Props<
        MdMenu,
        | 'open'
        | 'anchor'
        | 'positioning'
        | 'quick'
        | 'hasOverflow'
        | 'xOffset'
        | 'yOffset'
        | 'menuCorner'
        | 'anchorCorner'
        | 'typeaheadDelay'
        | 'defaultFocus'
      >;
      'md-menu-item': Props<MdMenuItem, 'disabled' | 'type' | 'href' | 'target' | 'keepOpen' | 'selected'>;

      // Fields
      'md-outlined-text-field': Props<
        MdOutlinedTextField,
        | 'value'
        | 'label'
        | 'type'
        | 'name'
        | 'disabled'
        | 'required'
        | 'readOnly'
        | 'error'
        | 'errorText'
        | 'supportingText'
        | 'maxLength'
        | 'minLength'
        | 'rows'
        | 'cols'
        | 'placeholder'
        | 'pattern'
        | 'min'
        | 'max'
        | 'autocomplete'
        | 'prefixText'
        | 'suffixText'
        | 'noAsterisk'
      >;
      'md-outlined-select': Props<
        MdOutlinedSelect,
        | 'value'
        | 'label'
        | 'name'
        | 'disabled'
        | 'required'
        | 'error'
        | 'errorText'
        | 'supportingText'
        | 'quick'
        | 'menuPositioning'
        | 'clampMenuWidth'
        | 'noAsterisk'
        | 'selectedIndex'
      >;
      'md-select-option': Props<MdSelectOption, 'value' | 'disabled' | 'selected' | 'displayText'>;
      'md-switch': Props<
        MdSwitch,
        'selected' | 'disabled' | 'icons' | 'showOnlySelectedIcon' | 'required' | 'name' | 'value'
      > & {
        'aria-label'?: string;
      };
      'md-checkbox': Props<MdCheckbox, 'checked' | 'indeterminate' | 'disabled' | 'required' | 'name' | 'value'> & {
        'aria-label'?: string;
      };
      'md-radio': Props<MdRadio, 'checked' | 'disabled' | 'required' | 'name' | 'value'> & {'aria-label'?: string};

      // Dialog, tabs, chips, progress
      'md-dialog': Props<MdDialog, 'open' | 'type' | 'quick' | 'returnValue' | 'noFocusTrap'>;
      'md-tabs': Props<MdTabs, 'activeTabIndex' | 'autoActivate'>;
      'md-primary-tab': Props<MdPrimaryTab, 'active' | 'inlineIcon' | 'hasIcon' | 'isTab'>;
      'md-secondary-tab': Props<MdSecondaryTab, 'active' | 'hasIcon' | 'isTab'>;
      'md-chip-set': Props<MdChipSet>;
      'md-filter-chip': Props<MdFilterChip, 'label' | 'selected' | 'disabled' | 'removable' | 'elevated' | 'hasIcon'>;
      'md-circular-progress': Props<MdCircularProgress, 'value' | 'max' | 'indeterminate' | 'fourColor'> & {
        'aria-label'?: string;
      };
      'md-linear-progress': Props<MdLinearProgress, 'value' | 'max' | 'indeterminate' | 'fourColor'> & {
        'aria-label'?: string;
      };

      // Design kit
      'moddy-app-bar': Props<ModdyAppBar, 'labels'> & {'home-href'?: string};
      'moddy-theme-menu': Props<ModdyThemeMenu, 'labels' | 'seeds'>;
      'moddy-user-menu': Props<ModdyUserMenu, 'user' | 'labels'> & {
        /** Fired by the built-in "Sign out" item. */
        'onsign-out'?: Listener<ModdyUserMenu>;
      };
    }
  }
}
