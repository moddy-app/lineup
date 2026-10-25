import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefCallback,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {createPortal} from 'react-dom';

import {cx} from '@/lib/cx';

import {Icon} from './Icon';
import {usePresence} from './motion';

export interface DropdownItem {
  key: string;
  label: string;
  /** Material Symbols name, before the label. */
  icon?: string;
  /** A picture instead of the icon (an avatar, a server icon). */
  leading?: ReactNode;
  /** `true` or `false` marks the current choice (a check, `secondary-container`); leave it out for a plain action. */
  selected?: boolean;
  /** Shown in the `error` color (delete). */
  destructive?: boolean;
  disabled?: boolean;
  /** A little more room above: a group apart. */
  separated?: boolean;
  /** The language of the label, when it is not the page's (a language's own name). */
  lang?: string;
  /** The popover stays open (the choice shows other items: a submenu); focus goes to its first choice. */
  keepOpen?: boolean;
  onSelect: () => void;
}

export interface DropdownTriggerProps {
  ref: RefCallback<HTMLElement>;
  /** Wire it to the click of the trigger (`onclick` on a custom element, `onClick` on a button). */
  onActivate: () => void;
  'aria-haspopup': 'menu' | 'listbox';
  'aria-expanded': boolean;
  'aria-controls'?: string;
}

interface DropdownProps {
  /** The element that opens the popover: a button, an `md-icon-button`... */
  trigger: (props: DropdownTriggerProps) => ReactNode;
  items: readonly DropdownItem[];
  /** Name of the popover, for assistive tech. */
  label: string;
  /** `menu` (actions, a context) or `listbox` (the options of a select). */
  role?: 'menu' | 'listbox';
  /** Which edge of the trigger the popover lines up with. `end` suits a `more_vert` at the right edge. */
  align?: 'start' | 'end';
  /** 18rem instead of 14rem (a long list). The popover is never narrower than its trigger when `matchTrigger`. */
  wide?: boolean;
  matchTrigger?: boolean;
  /** A line (icon and name, `--text-label`) above the choices, as in the filters. */
  header?: {icon?: string; label: string};
  /** Free content above the choices (the account card of the user menu). */
  top?: ReactNode;
  /** Free content under the choices (the theme panel of the narrow app bar's menu). */
  bottom?: ReactNode;
  className?: string;
}

const GAP = 6;
const MARGIN = 8;
const CHOICES =
  '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled), [role="option"]:not(:disabled)';

/** Focus the current choice, or the first. */
function focusChoice(element: HTMLElement) {
  const target =
    element.querySelector<HTMLElement>('[aria-checked="true"]:not(:disabled), [aria-selected="true"]:not(:disabled)') ??
    element.querySelector<HTMLElement>(CHOICES);
  target?.focus({preventScroll: true});
}

/**
 * The popover of the filters (`.filter-popover`, `.filter-option`) as a
 * shared primitive: menus (`more_vert`, context choice, compact navigation)
 * and the options of `Select`.
 *
 * It is drawn in the top layer (Popover API) from a portal, so a `Card`'s
 * `overflow: clip`, a dialog or a stacking context never cuts or covers it;
 * without the Popover API (tests) it is a fixed element. Inside an
 * `md-dialog` it goes into the dialog's slotted element (the rest of the page
 * is inert under a modal dialog). It is placed
 * from the trigger's rectangle when it opens and on resize, and closes on a
 * scroll of the page (nothing is computed while scrolling). Arrow keys, Home
 * and End move between choices, Enter chooses, Escape closes and gives focus
 * back to the trigger.
 */
export function Dropdown({
  trigger,
  items,
  label,
  role = 'menu',
  align = 'start',
  wide = false,
  matchTrigger = false,
  header,
  top,
  bottom,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const popover = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const kept = useRef(false);
  const {mounted, closing} = usePresence(open);

  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (!restoreFocus) return;
      window.setTimeout(() => {
        const active = document.activeElement;
        // The popover may still be on screen for its exit, with the focus in it.
        if (!active || active === document.body || popover.current?.contains(active)) anchor?.focus();
      }, 0);
    },
    [anchor],
  );

  // Place the popover from the trigger; focus the current choice (or the first).
  const place = useCallback(() => {
    const element = popover.current;
    if (!anchor || !element) return;
    element.style.setProperty('--dropdown-min', `${anchor.getBoundingClientRect().width}px`);
    const box = anchor.getBoundingClientRect();
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const viewport = document.documentElement.clientWidth;
    const rawLeft = align === 'end' ? box.right - width : box.left;
    const left = Math.max(MARGIN, Math.min(rawLeft, viewport - width - MARGIN));
    const below = box.bottom + GAP;
    const above = box.top - GAP - height;
    const top = below + height > window.innerHeight - MARGIN && above >= MARGIN ? above : below;
    element.style.setProperty('--dropdown-x', `${left}px`);
    element.style.setProperty('--dropdown-y', `${top}px`);
    // The entrance grows from the trigger's side (lineup.css `popover-in`).
    element.dataset.side = top === above ? 'top' : 'bottom';
    element.dataset.align = align;
  }, [anchor, align]);

  useLayoutEffect(() => {
    const element = popover.current;
    if (!open || !element) return;
    if (typeof element.showPopover === 'function' && !element.matches(':popover-open')) {
      try {
        element.showPopover();
      } catch {
        // Not connected yet: the fixed fallback still shows it.
      }
    }
    place();
    focusChoice(element);
  }, [open, place]);

  // After a `keepOpen` choice, the items have changed: place again, focus the new choices.
  useLayoutEffect(() => {
    if (!kept.current || !popover.current) return;
    kept.current = false;
    place();
    focusChoice(popover.current);
  });

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (!popover.current?.contains(target) && !anchor?.contains(target)) close(false);
    };
    const scrolled = (event: Event) => {
      if (event.target instanceof Node && popover.current?.contains(event.target)) return;
      close(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('scroll', scrolled, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('scroll', scrolled, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor, close, place]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Tab') {
      close(true);
      event.preventDefault();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const choices = [...(popover.current?.querySelectorAll<HTMLElement>(CHOICES) ?? [])];
    if (choices.length === 0) return;
    const index = choices.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? choices.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
    choices[next]?.focus({preventScroll: true});
    event.preventDefault();
  };

  const choiceRole = role === 'listbox' ? 'option' : 'menuitem';
  // In a dialog, the popover goes into the slotted element of the trigger (`slot="content"`...):
  // md-dialog has no default slot, so a direct child would never be drawn.
  const host: Element = anchor?.closest('md-dialog > [slot]') ?? document.body;

  return (
    <>
      {trigger({
        ref: setAnchor,
        onActivate: () => setOpen((previous) => !previous),
        'aria-haspopup': role,
        'aria-expanded': open,
        'aria-controls': open ? popoverId : undefined,
      })}
      {mounted &&
        createPortal(
          <div
            ref={popover}
            id={popoverId}
            data-state={closing ? 'closed' : 'open'}
            inert={closing}
            popover="manual"
            className={cx('filter-popover', 'dropdown-popover', wide && 'wide', matchTrigger && 'match', className)}
            role={role}
            aria-label={label}
            onKeyDown={onKeyDown}
            onClick={(event) => event.stopPropagation()}
          >
            <md-elevation aria-hidden="true" />
            {top}
            {header && (
              <p className="filter-popover-head" aria-hidden="true">
                {header.icon && <Icon name={header.icon} />}
                <span>{header.label}</span>
              </p>
            )}
            <div className="filter-popover-options">
              {items.map((item) => {
                const marked = item.selected !== undefined;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cx('filter-option', item.destructive && 'destructive', item.separated && 'separated')}
                    role={marked && role === 'menu' ? 'menuitemradio' : choiceRole}
                    aria-checked={marked && role === 'menu' ? item.selected : undefined}
                    aria-selected={role === 'listbox' ? Boolean(item.selected) : undefined}
                    data-selected={item.selected ? 'true' : undefined}
                    disabled={item.disabled}
                    lang={item.lang}
                    onClick={() => {
                      if (item.keepOpen) kept.current = true;
                      else close(true);
                      item.onSelect();
                    }}
                  >
                    {item.leading ?? (item.icon && <Icon name={item.icon} filled />)}
                    <span className="filter-option-label">{item.label}</span>
                    {item.selected && <Icon name="check" className="filter-option-check" />}
                  </button>
                );
              })}
            </div>
            {bottom}
          </div>,
          host,
        )}
    </>
  );
}
