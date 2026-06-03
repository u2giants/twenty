import { lazy } from 'react';
import { Route } from 'react-router-dom';

import { LazyRoute } from '@/app/components/LazyRoute';
import { popPaths } from '@/pop-creations/routes/popPaths';

const PopDashboard = lazy(() =>
  import('~/pages/pop-creations/MondayMorningDashboardPage').then((m) => ({
    default: m.MondayMorningDashboardPage,
  })),
);

const PopDomains = lazy(() =>
  import('~/pages/pop-creations/DomainManagerPage').then((m) => ({
    default: m.DomainManagerPage,
  })),
);

const PopLookupValues = lazy(() =>
  import('~/pages/pop-creations/LookupValuesPage').then((m) => ({
    default: m.LookupValuesPage,
  })),
);

/**
 * POP Creations route elements (not a component — must be JSX elements
 * because React Router's createRoutesFromElements only accepts <Route>
 * and <Fragment> elements, not custom components).
 *
 * To add a new page:
 *   1. Add the lazy import above.
 *   2. Add a <Route> entry below.
 *   3. Add the path to popPaths.ts.
 *   4. Done — useCreateAppRouter.tsx (core) never needs to change again.
 */
export const popCreationsRouteElements = (
  <>
    <Route
      path={popPaths.dashboard}
      element={
        <LazyRoute>
          <PopDashboard />
        </LazyRoute>
      }
    />
    <Route
      path={popPaths.domains}
      element={
        <LazyRoute>
          <PopDomains />
        </LazyRoute>
      }
    />
    <Route
      path={popPaths.lookupValues}
      element={
        <LazyRoute>
          <PopLookupValues />
        </LazyRoute>
      }
    />
  </>
);
