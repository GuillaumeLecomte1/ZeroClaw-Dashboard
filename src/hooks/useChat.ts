import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createZeroClawClient } from '../lib/zeroclaw-client';
import type { ChatMessage } from '../lib/types';

const client = createZeroClawClient();

export const chatKeys = {
  all: ['chat'] as const,
  history: (conversationId?: string) => [...chatKeys.all, 'history', conversationId] as const,
};

export interface SendMessageOptions {
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatHistoryData {
  messages: ChatMessage[];
  conversationId: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ text, options }: { text: string; options?: SendMessageOptions }) => {
      return client.sendMessage(text, {
        conversationId: options?.conversationId,
        metadata: options?.metadata,
      });
    },
    
    onMutate: async ({ text, options }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.all });

      const previousHistory = queryClient.getQueryData<ChatHistoryData>(
        chatKeys.history(options?.conversationId)
      );

      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content: text,
        role: 'user',
        timestamp: new Date().toISOString(),
      };

      queryClient.setQueryData<ChatHistoryData>(
        chatKeys.history(options?.conversationId),
        (old) => ({
          conversationId: options?.conversationId || 'default',
          messages: old ? [...old.messages, optimisticMessage] : [optimisticMessage],
        })
      );

      return { previousHistory };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousHistory) {
        queryClient.setQueryData(
          chatKeys.history(context.previousHistory.conversationId),
          context.previousHistory
        );
      }
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.history(variables.options?.conversationId),
      });
    },
  });
}

export function useChatHistory(conversationId?: string) {
  return useQuery({
    queryKey: chatKeys.history(conversationId),
    queryFn: async (): Promise<ChatHistoryData> => {
      return {
        conversationId: conversationId || 'default',
        messages: [],
      };
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}

export function useChatMessages(conversationId?: string) {
  const { data, ...rest } = useChatHistory(conversationId);
  return {
    messages: data?.messages ?? [],
    ...rest,
  };
}
