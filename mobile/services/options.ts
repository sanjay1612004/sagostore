import { useInfiniteQuery } from "@tanstack/react-query";
import { api, type Page } from "./api";
export function useOptions<T>(
  key: unknown[],
  endpoint: string,
  enabled = true,
) {
  const q = useInfiniteQuery({
    queryKey: key,
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Page<T>>(
        `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${pageParam}&limit=30`,
      ),
    getNextPageParam: (p) =>
      p.page * p.limit < p.total ? p.page + 1 : undefined,
  });
  return {
    ...q,
    items: q.data?.pages.flatMap((p) => p.items) ?? [],
    more: () => {
      if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
    },
  };
}
