import { useCallback, useMemo } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";

import { fetchConversations } from "@/features/chat/services/chatApi";
import { fetchUnreadNotificationsCount } from "@/services/notifications";
import { fetchUnreadIntimacoesCount } from "@/services/intimacoes";
import { fetchUnreadProcessosCount } from "@/services/processos";
import { fetchPendingAgendaCount } from "@/services/agenda";

export type SidebarCounterKey =
  | "messages"
  | "agenda"
  | "tasks"
  | "intimacoes"
  | "processos";

export type SidebarCounterState = {
  count?: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
};

export type SidebarCountersMap = Record<SidebarCounterKey, SidebarCounterState>;

export interface UseSidebarCountersResult {
  counters: SidebarCountersMap;
  refetchAll: () => Promise<unknown[]>;
}

const formatUnreadMessagesTotal = (response: Awaited<ReturnType<typeof fetchConversations>>): number =>
  response.chats.reduce((total, conversation) => {
    const unread = typeof conversation.unreadCount === "number" ? conversation.unreadCount : 0;
    return total + Math.max(0, unread);
  }, 0);

const toCounterState = (query: UseQueryResult<number, Error>): SidebarCounterState => ({
  count: query.status === "success" ? query.data ?? 0 : undefined,
  isLoading: query.isLoading,
  isFetching: query.isFetching,
  isError: query.isError,
});

export function useSidebarCounters(): UseSidebarCountersResult {
  const results = useQueries({
    queries: [
      {
        queryKey: ["sidebar", "unread", "messages"],
        queryFn: async () => {
          // Increase limit to capture more unread messages across recent conversations
          const response = await fetchConversations({ limit: 100 });
          return formatUnreadMessagesTotal(response);
        },
        staleTime: 60_000,
      },
      {
        queryKey: ["sidebar", "unread", "agenda"],
        queryFn: () => fetchPendingAgendaCount(),
        staleTime: 60_000,
      },
      {
        queryKey: ["sidebar", "unread", "tasks"],
        queryFn: () => fetchUnreadNotificationsCount("tasks"),
        staleTime: 60_000,
      },
      {
        queryKey: ["sidebar", "unread", "intimacoes"],
        queryFn: () => fetchUnreadIntimacoesCount(),
        staleTime: 60_000,
      },
      {
        queryKey: ["sidebar", "unread", "processos"],
        queryFn: () => fetchUnreadProcessosCount(),
        staleTime: 60_000,
      },
    ],
  });

  const counters = useMemo<SidebarCountersMap>(() => {
    const [messages, agenda, tasks, intimacoes, processos] = results as [
      UseQueryResult<number, Error>,
      UseQueryResult<number, Error>,
      UseQueryResult<number, Error>,
      UseQueryResult<number, Error>,
      UseQueryResult<number, Error>,
    ];

    return {
      messages: toCounterState(messages),
      agenda: toCounterState(agenda),
      tasks: toCounterState(tasks),
      intimacoes: toCounterState(intimacoes),
      processos: toCounterState(processos),
    };
  }, [results]);

  const refetchAll = useCallback(() => Promise.all(results.map((query) => query.refetch())), [results]);

  return { counters, refetchAll };
}
