import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Hash history prevents Electron file:// protocol 404s on page refresh
const hashHistory = createHashHistory();

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error: any) => {
          // Never retry permanent client/auth/permission/validation/missing errors
          if (
            error?.status === 400 ||
            error?.status === 401 ||
            error?.status === 403 ||
            error?.status === 404 ||
            error?.status === 409 ||
            error?.status === 422 ||
            error?.isForbidden ||
            error?.isUnauthorized ||
            error?.isNotFound ||
            error?.isValidationError ||
            error?.isConflict
          ) {
            return false;
          }
          // Retry transient network or 5xx server failures once
          return failureCount < 1;
        },
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: hashHistory,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

// Type registration for route context — keeps __root.tsx `useRouteContext` typed
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
