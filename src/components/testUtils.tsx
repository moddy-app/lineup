/* eslint-disable react-refresh/only-export-components -- test support, not a module that hot-reloads */

/**
 * Rendering helpers for the component tests: French, the catalog already in
 * the query cache (the labels come from it), a memory router for links, and the
 * snackbar. Not part of the app.
 */

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render} from '@testing-library/react';
import type {ReactElement, ReactNode} from 'react';
import {MemoryRouter} from 'react-router';

import {catalogFixture} from '@/api/catalog.fixture';
import {queryKeys} from '@/api/queryKeys';
import {SnackbarProvider} from '@/ui';

export function renderWithCatalog(ui: ReactElement, {path = '/'}: {path?: string} = {}) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  queryClient.setQueryData(queryKeys.catalog(), catalogFixture);
  // A wrapper, not a tree around `ui`: `rerender` then keeps the providers.
  const wrapper = ({children}: {children: ReactNode}) => (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </SnackbarProvider>
    </QueryClientProvider>
  );
  return {...render(ui, {wrapper}), queryClient};
}

/** What a component rendered itself: the container's children without the snackbar's live region. */
export function contentOf(container: HTMLElement): Element[] {
  return [...container.children].filter((element) => !element.classList.contains('snackbar'));
}
