import {createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState} from 'react';

export interface SnackbarOptions {
  message: string;
  /** One optional action ("Undo", "Retry"); the snackbar closes when it is used. */
  action?: {label: string; onClick: () => void};
}

interface SnackbarApi {
  show: (options: SnackbarOptions) => void;
  dismiss: () => void;
}

const SnackbarContext = createContext<SnackbarApi | null>(null);

/** Show a brief message at the bottom of the window: `useSnackbar().show({message})`. */
export function useSnackbar(): SnackbarApi {
  const api = use(SnackbarContext);
  if (!api) throw new Error('useSnackbar needs a <SnackbarProvider>.');
  return api;
}

/** How long a snackbar stays (Material 3: 4 to 10 seconds). */
const DURATION = 5000;

interface Item extends SnackbarOptions {
  id: number;
}

/**
 * One snackbar at a time; a new message replaces the current one. The
 * element is always in the page (an aria-live region must exist before its
 * content changes to be announced) and shows or hides with data-open. The
 * timer stops while the pointer or the keyboard focus is on it.
 */
export function SnackbarProvider({children}: {children: ReactNode}) {
  const [item, setItem] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const counter = useRef(0);

  const show = useCallback((options: SnackbarOptions) => {
    counter.current += 1;
    setItem({...options, id: counter.current});
    setOpen(true);
  }, []);
  const dismiss = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || held) return;
    const timer = setTimeout(() => setOpen(false), DURATION);
    return () => clearTimeout(timer);
  }, [open, held, item?.id]);

  const api = useMemo(() => ({show, dismiss}), [show, dismiss]);

  return (
    <SnackbarContext value={api}>
      {children}
      <div
        className="snackbar"
        data-open={open}
        aria-live="polite"
        aria-atomic="true"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
      >
        {item && (
          <>
            <span className="snackbar-message">{item.message}</span>
            {item.action && (
              <md-text-button
                className="snackbar-action"
                tabIndex={open ? 0 : -1}
                onclick={() => {
                  item.action?.onClick();
                  setOpen(false);
                }}
              >
                {item.action.label}
              </md-text-button>
            )}
          </>
        )}
      </div>
    </SnackbarContext>
  );
}
