import type {MdCheckbox} from '@material/web/checkbox/checkbox.js';
import type {MdSwitch} from '@material/web/switch/switch.js';
import type {ReactNode} from 'react';

import {cx} from '@/lib/cx';

import {useControlledElement} from './useControlledElement';

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The visible label; it also names the control for assistive tech and toggles it on click. */
  label: ReactNode;
  /** Plain-text name, when `label` is not a string. */
  ariaLabel?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}

/** A switch with its label (the whole row toggles it). */
export function Switch({checked, onCheckedChange, label, ariaLabel, className, ...props}: ToggleProps) {
  const {ref, handleChange} = useControlledElement<MdSwitch, boolean>(
    checked,
    (element) => element.selected,
    (element, next) => {
      element.selected = next;
    },
    onCheckedChange,
  );
  return (
    <label className={cx('toggle', className)}>
      <md-switch
        {...props}
        ref={ref}
        selected={checked}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        onchange={handleChange}
      />
      <span>{label}</span>
    </label>
  );
}

/** A checkbox with its label (the whole row toggles it). */
export function Checkbox({checked, onCheckedChange, label, ariaLabel, className, ...props}: ToggleProps) {
  const {ref, handleChange} = useControlledElement<MdCheckbox, boolean>(
    checked,
    (element) => element.checked,
    (element, next) => {
      element.checked = next;
    },
    onCheckedChange,
  );
  return (
    <label className={cx('toggle', className)}>
      <md-checkbox
        {...props}
        ref={ref}
        checked={checked}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        onchange={handleChange}
      />
      <span>{label}</span>
    </label>
  );
}
