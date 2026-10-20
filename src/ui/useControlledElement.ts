import {useLayoutEffect, useRef} from 'react';
import {flushSync} from 'react-dom';

/**
 * Makes a Material Web field a controlled input.
 *
 * React 19 already sets `value` (a property of the element) when the prop
 * changes, which covers "state changed, show it". What it cannot cover is
 * "the person typed, the parent kept the old value": React sees no prop
 * change and the field would keep the rejected text. So after every change
 * event the parent's decision is applied synchronously (flushSync) and the
 * element is made to show it.
 */
export function useControlledElement<T extends HTMLElement, V>(
  value: V,
  read: (element: T) => V,
  write: (element: T, value: V) => void,
  onChange: ((value: V) => void) | undefined,
) {
  const ref = useRef<T>(null);
  const latest = useRef(value);
  const sync = useRef({read, write});

  // Runs after each render: the element shows what the state says.
  useLayoutEffect(() => {
    latest.current = value;
    sync.current = {read, write};
    const element = ref.current;
    if (element && sync.current.read(element) !== value) sync.current.write(element, value);
  });

  const handleChange = (event: Event & {currentTarget: T}) => {
    const element = event.currentTarget;
    const next = sync.current.read(element);
    if (next === latest.current) return;
    flushSync(() => onChange?.(next));
    if (sync.current.read(element) !== latest.current) sync.current.write(element, latest.current);
  };

  return {ref, handleChange};
}
