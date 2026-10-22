import {QueryClientProvider} from '@tanstack/react-query';
import {useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router';

import {SnackbarProvider} from '@/ui';

import {setPreloadClient} from './preload';
import {createQueryClient} from './queryClient';
import {routes} from './routes';

/**
 * Providers, then the router. The session (SessionProvider) is inside the
 * router, around the shell: signing out navigates.
 */
export function App() {
  const [queryClient] = useState(() => {
    const client = createQueryClient();
    setPreloadClient(client);
    return client;
  });
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider>
        <RouterProvider router={router} />
      </SnackbarProvider>
    </QueryClientProvider>
  );
}
