import {useEffect} from 'react';

const SITE = 'Lineup';

/** Sets `document.title` to "<title> · Lineup" (just "Lineup" without a title). */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);
}
