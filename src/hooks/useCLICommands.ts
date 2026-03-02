import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const cliKeys = {
  all: ['cli'] as const,
  execute: (command: string) => [...cliKeys.all, 'execute', command] as const,
  history: () => [...cliKeys.all, 'history'] as const,
  allowed: () => [...cliKeys.all, 'allowed'] as const,
};

export interface CLIExecuteRequest {
  command: string;
  args?: string[];
  cwd?: string;
}

export interface CLIExecuteResponse {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface AllowedCommands {
  commands: string[];
  subcommands: Record<string, string[]>;
}

export interface CLIHistoryItem {
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  timestamp: string;
}

const CLI_HISTORY_KEY = 'zeroclaw_cli_history';
const MAX_HISTORY = 50;

function getBaseUrl(): string {
  return import.meta.env.VITE_ZEROCLAW_API_URL || 'http://localhost:3033';
}

function getAuthToken(): string {
  return import.meta.env.VITE_ZEROCLAW_TOKEN || '';
}

function getHistoryFromStorage(): CLIHistoryItem[] {
  try {
    const stored = localStorage.getItem(CLI_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistoryToStorage(history: CLIHistoryItem[]): void {
  try {
    localStorage.setItem(CLI_HISTORY_KEY, JSON.stringify(history));
  } catch (e) { void e; }
}

export function useExecuteCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CLIExecuteRequest): Promise<CLIExecuteResponse> => {
      const baseUrl = getBaseUrl();
      const token = getAuthToken();

      const response = await fetch(`${baseUrl}/api/cli/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Command execution failed');
      }

      return response.json();
    },

    onSuccess: (data, variables) => {
      const historyItem: CLIHistoryItem = {
        id: `cmd-${Date.now()}`,
        command: variables.command,
        args: variables.args,
        cwd: variables.cwd,
        success: data.success,
        stdout: data.stdout,
        stderr: data.stderr,
        exitCode: data.exitCode,
        timestamp: new Date().toISOString(),
      };

      const history = getHistoryFromStorage();
      history.unshift(historyItem);
      if (history.length > MAX_HISTORY) {
        history.pop();
      }
      saveHistoryToStorage(history);

      queryClient.invalidateQueries({ queryKey: cliKeys.history() });
    },
  });
}

export function useCommandHistory() {
  return useQuery({
    queryKey: cliKeys.history(),
    queryFn: async (): Promise<CLIHistoryItem[]> => {
      return getHistoryFromStorage();
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
  });
}

export function useAllowedCommands() {
  return useQuery({
    queryKey: cliKeys.allowed(),
    queryFn: async (): Promise<AllowedCommands> => {
      const baseUrl = getBaseUrl();
      const token = getAuthToken();

      const response = await fetch(`${baseUrl}/api/cli/allowed`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch allowed commands');
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });
}
