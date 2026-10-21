import type {MdOutlinedTextField} from '@material/web/textfield/outlined-text-field.js';
import type {Ref} from 'react';

import {cx} from '@/lib/cx';

import {useControlledElement} from './useControlledElement';

interface TextFieldProps {
  label: string;
  /** Controlled: the value shown. */
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  type?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'password' | 'number' | 'date';
  /** More than one row makes it a textarea. */
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  autocomplete?: string;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  /** Shows a character counter under the field, and stops typing at the limit. */
  maxLength?: number;
  supportingText?: string;
  /** `false` keeps the limit but hides the counter (a search field). Default `true`. */
  counter?: boolean;
  /** Puts the field in its error state and replaces the supporting text. */
  errorText?: string;
  error?: boolean;
  className?: string;
  ref?: Ref<MdOutlinedTextField>;
  id?: string;
}

/**
 * md-outlined-text-field as a controlled React input. The counter and the
 * limit come from Material Web's `maxlength` (the counter appears when it is
 * set). Full width by default (.field in lineup.css).
 */
export function TextField({
  value,
  onValueChange,
  rows,
  type = 'text',
  errorText,
  error,
  className,
  counter = true,
  maxLength,
  ref: forwardedRef,
  ...props
}: TextFieldProps) {
  const {ref, handleChange} = useControlledElement<MdOutlinedTextField, string>(
    value,
    (element) => element.value,
    (element, next) => {
      element.value = next;
    },
    onValueChange,
  );

  const setRef = (element: MdOutlinedTextField | null) => {
    ref.current = element;
    if (element && !counter && maxLength) {
      // Material Web draws the counter whenever `maxlength` is set on the field:
      // put the limit on the native input instead.
      void element.updateComplete.then(() => {
        element.renderRoot?.querySelector('input')?.setAttribute('maxlength', String(maxLength));
      });
    }
    if (typeof forwardedRef === 'function') forwardedRef(element);
    else if (forwardedRef) forwardedRef.current = element;
  };

  return (
    <md-outlined-text-field
      {...props}
      maxLength={counter ? maxLength : undefined}
      ref={setRef}
      className={cx('field', className)}
      value={value}
      type={rows && rows > 1 ? 'textarea' : type}
      rows={rows && rows > 1 ? rows : undefined}
      error={Boolean(error || errorText)}
      errorText={errorText ?? ''}
      oninput={handleChange}
    />
  );
}
