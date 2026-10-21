import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Dropdown, type DropdownTriggerProps, Icon, TextField, usePresence} from '@/ui';

import {activeKeys, appendKey, type ChipState, remainingKeys, toggleValue} from './logic';
import {CLOSE_GUARD_MS, type FilterDefinition, type FilterSearch, OPEN_DELAY_MS} from './types';

interface FilterBarProps<K extends string> {
  search: FilterSearch;
  /** The filters, in the order of the "add" menu. */
  filters: Record<K, FilterDefinition>;
  /** More icon buttons in the toolbar, after the funnel (a sort, a view toggle). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Search, a funnel button and filter chips (docs/ui-redesign.md, "Chips de
 * filtre").
 *
 * The funnel opens a menu of the filters not in use. Choosing one adds its
 * chip and opens its popover 160 ms later; a popover closed without a value
 * takes its chip away; "+ Add a filter" ends the row while filters remain.
 * Values live in the parent (the URL); the order of the chips and which
 * popover is open live here. A filter that already has a value on the first
 * render (a shared link) starts as a chip.
 */
export function FilterBar<K extends string>({search, filters, trailing, className}: FilterBarProps<K>) {
  const {t} = useT('components');
  const keys = Object.keys(filters) as K[];
  const hasValue = (key: K) => filters[key].value.length > 0;

  const [state, setState] = useState<ChipState<K>>(() => ({
    order: keys.filter((key) => filters[key].value.length > 0),
    open: null,
    adding: null,
  }));
  const active = activeKeys(keys, state, hasValue);
  const remaining = remainingKeys(keys, active);

  const openedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chipRefs = useRef(new Map<K, HTMLButtonElement>());
  const funnelRef = useRef<HTMLElement | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const addFilter = useCallback((key: K) => {
    clearTimeout(timer.current);
    setState((previous) => ({...previous, order: appendKey(previous.order, key), adding: key, open: null}));
    timer.current = setTimeout(() => {
      openedAt.current = Date.now();
      setState((previous) => ({...previous, adding: null, open: key}));
    }, OPEN_DELAY_MS);
  }, []);

  const openFilter = useCallback((key: K) => {
    openedAt.current = Date.now();
    setState((previous) => ({...previous, open: key, adding: null}));
  }, []);

  /**
   * Closes the popover of `key`. `force` skips the 250 ms guard (the person
   * chose something, or pressed "Remove"). `restoreFocus`: back to the chip,
   * or to the funnel when the chip is gone.
   */
  const closeFilter = useCallback((key: K, {force = false, restoreFocus = false} = {}) => {
    if (!force && Date.now() - openedAt.current < CLOSE_GUARD_MS) return;
    setState((previous) => (previous.open === key ? {...previous, open: null} : previous));
    if (restoreFocus) {
      setTimeout(() => (chipRefs.current.get(key) ?? funnelRef.current)?.focus(), 0);
    }
  }, []);

  return (
    <div className={cx('filter-bar', className)}>
      <div className="filter-toolbar">
        <TextField
          className="filter-search"
          label={search.placeholder}
          value={search.value}
          onValueChange={search.onChange}
          type="search"
          leadingIcon="search"
          counter={false}
          autocomplete="off"
        />
        <FilterMenu
          items={remaining.map((key) => ({key, icon: filters[key].icon, label: filters[key].label}))}
          onPick={addFilter}
          label={t('filters.add')}
          allUsedLabel={t('filters.allUsed')}
          trigger={({ref, onActivate, ...triggerProps}) => (
            <md-icon-button
              {...triggerProps}
              onclick={onActivate}
              ref={(element: HTMLElement | null) => {
                funnelRef.current = element;
                setRef(ref, element);
              }}
              className={cx('filter-toggle', active.length > 0 && 'active')}
              aria-label={t('filters.open')}
              title={t('filters.open')}
            >
              <md-icon>filter_list</md-icon>
            </md-icon-button>
          )}
        />
        {trailing}
      </div>

      {active.length > 0 && (
        <div className="filter-chips">
          {active.map((key) => (
            <FilterChip
              key={key}
              definition={filters[key]}
              open={state.open === key}
              buttonRef={(element) => {
                if (element) chipRefs.current.set(key, element);
                else chipRefs.current.delete(key);
              }}
              onOpen={() => openFilter(key)}
              onClose={(options) => closeFilter(key, options)}
              onToggle={() => (state.open === key ? closeFilter(key) : openFilter(key))}
            />
          ))}
          {remaining.length > 0 && (
            <FilterMenu
              items={remaining.map((key) => ({key, icon: filters[key].icon, label: filters[key].label}))}
              onPick={addFilter}
              label={t('filters.add')}
              allUsedLabel={t('filters.allUsed')}
              trigger={({ref, onActivate, ...triggerProps}) => (
                <button
                  type="button"
                  {...triggerProps}
                  onClick={onActivate}
                  ref={ref as Ref<HTMLButtonElement>}
                  className="filter-add"
                >
                  <Icon name="add" />
                  <span>{t('filters.add')}</span>
                </button>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}

function setRef<T>(ref: Ref<T>, element: T | null) {
  if (typeof ref === 'function') ref(element);
  else if (ref) (ref as {current: T | null}).current = element;
}

// ---------------------------------------------------------------------------
// The "add a filter" menu
// ---------------------------------------------------------------------------

interface FilterMenuProps<K extends string> {
  items: Array<{key: K; icon: string; label: string}>;
  onPick: (key: K) => void;
  /** Name of the menu, for assistive tech. */
  label: string;
  allUsedLabel: string;
  trigger: (props: DropdownTriggerProps) => ReactNode;
}

/** A `Dropdown` under its trigger (the funnel, or the "+ Add a filter" chip). */
function FilterMenu<K extends string>({items, onPick, label, allUsedLabel, trigger}: FilterMenuProps<K>) {
  return (
    <Dropdown
      label={label}
      items={
        items.length === 0
          ? [{key: 'all-used', label: allUsedLabel, disabled: true, onSelect: () => {}}]
          : items.map((item) => ({key: item.key, icon: item.icon, label: item.label, onSelect: () => onPick(item.key)}))
      }
      trigger={trigger}
    />
  );
}

// ---------------------------------------------------------------------------
// A chip and its popover
// ---------------------------------------------------------------------------

interface FilterChipProps {
  definition: FilterDefinition;
  open: boolean;
  buttonRef: (element: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onToggle: () => void;
  onClose: (options?: {force?: boolean; restoreFocus?: boolean}) => void;
}

function FilterChip({definition, open, buttonRef, onToggle, onClose}: FilterChipProps) {
  const {t} = useT('components');
  const wrap = useRef<HTMLSpanElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const {mounted, closing} = usePresence(open);
  const {icon, label, kind, options, value, onChange} = definition;

  const selectedLabels = options.filter((option) => value.includes(option.value)).map((option) => option.label);

  // Close on a pointer press outside, on Escape (below) and when focus leaves.
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!wrap.current?.contains(event.target as Node)) onClose();
    };
    const leaves = (event: FocusEvent) => {
      if (event.target instanceof Node && !wrap.current?.contains(event.target)) onClose();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', leaves);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', leaves);
    };
  }, [open, onClose]);

  // On open: keep the popover inside the window (it moves left when the chip is near the right edge), then focus.
  useLayoutEffect(() => {
    const element = popover.current;
    if (!open || !element) return;
    element.style.setProperty('--popover-shift', '0px');
    const box = element.getBoundingClientRect();
    const margin = 8;
    const overflow = box.right - (document.documentElement.clientWidth - margin);
    const shift = overflow > 0 ? Math.min(overflow, Math.max(0, box.left - margin)) : 0;
    element.style.setProperty('--popover-shift', `${-shift}px`);
    const target =
      element.querySelector<HTMLElement>('[aria-pressed="true"]') ?? element.querySelector<HTMLElement>('button');
    target?.focus({preventScroll: true});
  }, [open]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose({force: true, restoreFocus: true});
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = [...(popover.current?.querySelectorAll<HTMLElement>('button') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    buttons[(next + buttons.length) % buttons.length]?.focus();
    event.preventDefault();
  };

  const choose = (optionValue: string) => {
    onChange(toggleValue(kind, value, optionValue));
    // A single choice is done; several can follow.
    if (kind === 'single') onClose({force: true, restoreFocus: true});
  };

  return (
    <span className="filter-chip-wrap" ref={wrap}>
      <button
        type="button"
        ref={buttonRef}
        className="filter-chip"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={onToggle}
      >
        <Icon name={icon} />
        <span className="filter-chip-label">
          {label}
          {selectedLabels.length > 0 && ':'}
        </span>
        {selectedLabels.length > 0 && <span className="filter-chip-value">{selectedLabels.join(', ')}</span>}
        <Icon name="expand_more" className="filter-chip-chevron" />
      </button>
      {mounted && (
        <div
          ref={popover}
          id={popoverId}
          data-state={closing ? 'closed' : 'open'}
          inert={closing}
          className={cx('filter-popover', options.length > 8 && 'wide')}
          role="group"
          aria-label={label}
          onKeyDown={onKeyDown}
        >
          <p className="filter-popover-head">
            <Icon name={icon} />
            <span>{label}</span>
          </p>
          <div className="filter-popover-options">
            {options.map((option) => {
              const selected = value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className="filter-option"
                  aria-pressed={selected}
                  onClick={() => choose(option.value)}
                >
                  {option.icon && <Icon name={option.icon} />}
                  <span className="filter-option-label">{option.label}</span>
                  {selected && <Icon name="check" className="filter-option-check" />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="filter-remove"
            onClick={() => {
              onChange([]);
              onClose({force: true, restoreFocus: true});
            }}
          >
            <Icon name="delete" />
            <span>{t('filters.remove')}</span>
          </button>
        </div>
      )}
    </span>
  );
}
