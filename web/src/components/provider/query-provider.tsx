import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  // 401 清空会话后同步清查询缓存：重新登录不得吃到旧账号的 30s 缓存。
  useEffect(() => {
    const clearCache = () => queryClient.clear();
    window.addEventListener("chenmeridian:unauthorized", clearCache);
    return () => window.removeEventListener("chenmeridian:unauthorized", clearCache);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
