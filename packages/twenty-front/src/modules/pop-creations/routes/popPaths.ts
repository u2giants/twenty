/**
 * POP Creations route paths.
 *
 * To add a new page:
 *   1. Add the path string here.
 *   2. Add the route to popCreationsRoutes.tsx.
 *   3. Done — AppPath.ts (in twenty-shared) never needs to change.
 *
 * Keeping paths here instead of AppPath.ts means AppPath.ts stays 100%
 * stock Twenty code, which eliminates a recurring upstream merge conflict.
 */
export const popPaths = {
  dashboard: '/pop/dashboard',
  domains: '/pop/domains',
  lookupValues: '/pop/lookup-values',
} as const;
