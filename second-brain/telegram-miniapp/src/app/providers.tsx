import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import type { PropsWithChildren } from "react";

import { registerUnauthorizedHandler } from "../services/api";
import { startTextDumpQueueListener } from "../services/dumpQueue";
import { useSessionStore } from "../store/useSessionStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      useSessionStore.getState().clearSession();
    });
    return startTextDumpQueueListener();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
