export interface FilterOption {
  value: string;
  label: string;
  /** Material Symbol, drawn before the label. */
  icon?: string;
}

/** One filter of a `FilterBar`. */
export interface FilterDefinition {
  /** Material Symbol of the filter (chip, popover header, "add" menu). */
  icon: string;
  /** Already translated ("Position"). */
  label: string;
  /** `single`: none or one value. `multi`: any number. */
  kind: 'single' | 'multi';
  options: readonly FilterOption[];
  /** The selected option values. Empty: the filter is not applied. */
  value: readonly string[];
  /** Called with the new selection (`[]` removes the filter). */
  onChange: (values: string[]) => void;
}

export interface FilterSearch {
  value: string;
  onChange: (value: string) => void;
  /** Also the accessible label of the field. */
  placeholder: string;
}

/** After the "add a filter" choice, the popover of the new chip opens this late (ms). */
export const OPEN_DELAY_MS = 160;
/** A close request this soon after a popover opened is ignored (ms): it is the click that opened it. */
export const CLOSE_GUARD_MS = 250;
