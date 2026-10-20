import '@tanstack/react-query';

import type {ApiError} from './client';

declare module '@tanstack/react-query' {
  interface Register {
    /** Every failed request is an ApiError (apiFetch). */
    defaultError: ApiError;
    /** `requiresAuth`: a 401 on this query means the session is gone (routeApiError). */
    queryMeta: {requiresAuth?: boolean};
  }
}
