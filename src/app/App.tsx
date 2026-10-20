import {QueryClientProvider} from '@tanstack/react-query';
import {useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router';

import {SessionProvider} from '@/auth/session';
import {SnackbarProvider} from '@/ui';

import {createQueryClient} from './queryClient';
import {routes} from './routes';

/** Providers, then the router. */
export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <SnackbarProvider>
          <RouterProvider router={router} />
        </SnackbarProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
