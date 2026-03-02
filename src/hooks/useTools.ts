import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createZeroClawClient } from '../lib/zeroclaw-client';
import type { ToolInvocationResponse } from '../lib/types';

const client = createZeroClawClient();

export const toolKeys = {
  all: ['tools'] as const,
  list: () => [...toolKeys.all, 'list'] as const,
  invocation: (invocationId: string) => [...toolKeys.all, 'invocation', invocationId] as const,
};

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface ToolListData {
  tools: ToolDefinition[];
}

export function useTools() {
  return useQuery({
    queryKey: toolKeys.list(),
    queryFn: async (): Promise<ToolListData> => {
      return { tools: [] };
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

export function useInvokeTool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ toolName, args }: { toolName: string; args: Record<string, unknown> }): Promise<ToolInvocationResponse> => {
      return client.invokeTool(toolName, args);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: toolKeys.all });
    },
  });
}
