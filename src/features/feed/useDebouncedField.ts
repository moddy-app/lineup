import {useEffect, useRef, useState} from 'react';

/**
 * A text field that writes to the URL after a pause. `value` is what the URL
 * holds; the field keeps its own text while the person types, follows the URL
 * when it changes elsewhere (reset, back button), and commits `delay` ms after
 * the last keystroke.
 */
export function useDebouncedField(value: string, commit: (next: string) => void, delay: number) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  // The URL moved by itself: the field follows.
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => commitRef.current(text), delay);
    return () => window.clearTimeout(timer);
  }, [text, value, delay]);

  return [text, setText] as const;
}
