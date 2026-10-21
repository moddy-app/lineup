/**
 * "Save your work before leaving" (LINEUP.md §2: keep the form's state before
 * the redirection). Signing in sends the whole page to Discord and back, so a
 * form that holds unsent work registers a callback here; it runs just before
 * the browser leaves, and writes the draft to sessionStorage (src/lib/storage)
 * to be restored when the page comes back.
 *
 *   useEffect(() => registerBeforeLogin(() => setItem('post-draft', values, 'session')), [values]);
 */

type Callback = () => void;

const callbacks = new Set<Callback>();

/** Registers a callback; returns the function that unregisters it. */
export function registerBeforeLogin(callback: Callback): () => void {
  callbacks.add(callback);
  return () => {
    callbacks.delete(callback);
  };
}

/** Runs every callback. One that throws never stops the others, nor the sign-in. */
export function runBeforeLogin(): void {
  for (const callback of [...callbacks]) {
    try {
      callback();
    } catch (error) {
      console.error('A before-login callback failed.', error);
    }
  }
}
