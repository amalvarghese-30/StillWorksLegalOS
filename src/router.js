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
                retry: 1,
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
