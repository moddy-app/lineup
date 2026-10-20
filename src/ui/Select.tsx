import type {MdOutlinedSelect} from '@material/web/select/outlined-select.js';

import {cx} from '@/lib/cx';

import {useControlledElement} from './useControlledElement';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  name?: string;
  required?: boolean;
  disabled?: boolean;
  supportingText?: string;
  errorText?: string;
  error?: boolean;
  className?: string;
  id?: string;
}

/** md-outlined-select as a controlled React input. */
export function Select({value, onValueChange, options, errorText, error, className, ...props}: SelectProps) {
  const {ref, handleChange} = useControlledElement<MdOutlinedSelect, string>(
    value,
    (element) => element.value,
    (element, next) => {
      element.value = next;
    },
    onValueChange,
  );

  return (
    <md-outlined-select
      {...props}
      ref={ref}
      className={cx('field', className)}
      value={value}
      error={Boolean(error || errorText)}
      errorText={errorText ?? ''}
      onchange={handleChange}
    >
      {options.map((option) => (
        <md-select-option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          selected={option.value === value}
        >
          <div slot="headline">{option.label}</div>
        </md-select-option>
      ))}
    </md-outlined-select>
  );
}
