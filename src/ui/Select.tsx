import {cx} from '@/lib/cx';

import {Dropdown} from './Dropdown';
import {Icon} from './Icon';

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

/**
 * A select: a field-like button (label, value, chevron) that opens the shared
 * `Dropdown` as a listbox. A long list (more than 8 options, time zones) gets
 * the wide popover and scrolls inside.
 */
export function Select({
  label,
  value,
  onValueChange,
  options,
  name,
  required,
  disabled,
  supportingText,
  errorText,
  error,
  className,
  id,
}: SelectProps) {
  const selected = options.find((option) => option.value === value);
  const invalid = Boolean(error || errorText);
  const note = errorText || supportingText;
  return (
    <div className={cx('select-field', invalid && 'error', className)}>
      <Dropdown
        role="listbox"
        label={label}
        matchTrigger
        wide={options.length > 8}
        items={options.map((option) => ({
          key: option.value,
          label: option.label,
          disabled: option.disabled,
          selected: option.value === value,
          onSelect: () => onValueChange(option.value),
        }))}
        trigger={({ref, onActivate, ...aria}) => (
          <button
            {...aria}
            type="button"
            ref={ref}
            id={id}
            className="select-trigger"
            disabled={disabled}
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            onClick={onActivate}
          >
            <span className="select-text">
              <span className="select-label">{label}</span>
              <span className="select-value">{selected?.label ?? ' '}</span>
            </span>
            <Icon name="expand_more" className="select-chevron" />
          </button>
        )}
      />
      {name && <input type="hidden" name={name} value={value} />}
      {note && <p className="select-support">{note}</p>}
    </div>
  );
}
