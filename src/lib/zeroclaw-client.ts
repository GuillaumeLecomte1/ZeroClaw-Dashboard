import type {
  ZeroClawClientConfig,
  WebSocketConfig,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ToolInvocationRequest,
  ToolInvocationResponse,
  ToolResult,
  WebSocketMessage,
  WebSocketMessageType,
  WebSocketMessageHandler,
  WebSocketErrorHandler,
  WebSocketConnectionHandler,
  ZeroClawClient,
  ZeroClawWebSocket,
} from './types';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_WS_RECONNECT_DELAY = 3000;
const DEFAULT_WS_MAX_RECONNECT = 5;

function getAuthToken(): string {
  const token = import.meta.env.VITE_ZEROCLAW_TOKEN;
  if (!token) {
    throw new Error('ZeroClaw token not found. Set VITE_ZEROCLAW_TOKEN environment variable.');
  }
  return token;
}

function getBaseUrl(): string {
  return import.meta.env.VITE_ZEROCLAW_API_URL || 'http://localhost:3033';
}

function getWebSocketUrl(): string {
  const wsUrl = import.meta.env.VITE_ZEROCLAW_WS_URL;
  if (wsUrl) return wsUrl;
  
  const baseUrl = getBaseUrl();
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const host = baseUrl.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${host}/ws`;
}

export function createZeroClawClient(config?: Partial<ZeroClawClientConfig>): ZeroClawClient {
  const baseUrl = config?.baseUrl || getBaseUrl();
  const token = config?.token || getAuthToken();
  const timeout = config?.timeout || DEFAULT_TIMEOUT;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`ZeroClaw API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function sendMessage(
    text: string,
    options?: { conversationId?: string; metadata?: Record<string, unknown> }
  ): Promise<ChatResponse> {
    const chatRequest: ChatRequest = {
      text,
      conversationId: options?.conversationId,
      metadata: options?.metadata,
    };

    return request<ChatResponse>('/v1/responses', {
      method: 'POST',
      body: JSON.stringify(chatRequest),
    });
  }

  async function invokeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolInvocationResponse> {
    const invocationRequest: ToolInvocationRequest = {
      toolName,
      args,
    };

    return request<ToolInvocationResponse>('/tools/invoke', {
      method: 'POST',
      body: JSON.stringify(invocationRequest),
    });
  }

  function connectWebSocket(wsConfig?: Partial<WebSocketConfig>): ZeroClawWebSocket {
    const token = wsConfig?.token || getAuthToken();
    const url = wsConfig?.url || getWebSocketUrl();
    const reconnectDelay = wsConfig?.reconnectDelay || DEFAULT_WS_RECONNECT_DELAY;
    const maxReconnectAttempts = wsConfig?.maxReconnectAttempts || DEFAULT_WS_MAX_RECONNECT;

    let socket: WebSocket | null = null;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isIntentionallyDisconnected = false;

    let textMessageHandler: WebSocketMessageHandler | null = null;
    let errorHandler: WebSocketErrorHandler | null = null;
    let connectedHandler: WebSocketConnectionHandler | null = null;
    let disconnectedHandler: ((reason?: string) => void) | null = null;
    let toolInvocationHandler: ((invocation: ToolInvocationRequest) => void) | null = null;
    let toolResultHandler: ((result: { toolName: string; result: unknown; success: boolean; error?: string }) => void) | null = null;

    function handleMessage(event: MessageEvent) {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        if (message.type === 'message' || message.type === 'delta') {
          textMessageHandler?.(message);
        } else if (message.type === 'error') {
          errorHandler?.(new Error((message as { message: string }).message));
        } else if (message.type === 'connected') {
          reconnectAttempts = 0;
          connectedHandler?.((message as { sessionId: string }).sessionId);
        } else if (message.type === 'disconnected') {
          disconnectedHandler?.((message as { reason?: string }).reason);
        } else if (message.type === 'tool_invocation') {
          toolInvocationHandler?.((message as { invocation: ToolInvocationRequest }).invocation);
        } else if (message.type === 'tool_result') {
          toolResultHandler?.((message as { result: { toolName: string; result: unknown; success: boolean; error?: string } }).result);
        }
      } catch (err) {
        errorHandler?.(err instanceof Error ? err : new Error('Failed to parse WebSocket message'));
      }
    }

    function handleError() {
      errorHandler?.(new Error('WebSocket connection error'));
    }

    function handleClose() {
      if (!isIntentionallyDisconnected && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        reconnectTimer = setTimeout(() => {
          connect();
        }, reconnectDelay);
      } else if (!isIntentionallyDisconnected) {
        errorHandler?.(new Error('WebSocket reconnection failed'));
      }
    }

    function connect() {
      if (socket?.readyState === WebSocket.OPEN) return;

      isIntentionallyDisconnected = false;
      const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(wsUrl);

      socket.onmessage = handleMessage;
      socket.onerror = handleError;
      socket.onclose = handleClose;
      socket.onopen = () => {
        reconnectAttempts = 0;
      };
    }

    function disconnect() {
      isIntentionallyDisconnected = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.close();
        socket = null;
      }
    }

    return {
      connect,
      disconnect,
      isConnected: () => socket?.readyState === WebSocket.OPEN,
      sendMessage: (content: string) => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'message', content }));
        }
      },
      sendToolInvocation: (toolName: string, args: Record<string, unknown>) => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'tool_invocation', toolName, args }));
        }
      },
      onTextMessage: (handler: WebSocketMessageHandler) => {
        textMessageHandler = handler;
      },
      onError: (handler: WebSocketErrorHandler) => {
        errorHandler = handler;
      },
      onConnected: (handler: WebSocketConnectionHandler) => {
        connectedHandler = handler;
      },
      onDisconnected: (handler: (reason?: string) => void) => {
        disconnectedHandler = handler;
      },
      onToolInvocation: (handler: (invocation: ToolInvocationRequest) => void) => {
        toolInvocationHandler = handler;
      },
      onToolResult: (handler: (result: { toolName: string; result: unknown; success: boolean; error?: string }) => void) => {
        toolResultHandler = handler;
      },
    };
  }

  return {
    sendMessage,
    invokeTool,
    connectWebSocket,
    close: () => {},
  };
}

export type {
  ZeroClawClientConfig,
  WebSocketConfig,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ToolInvocationRequest,
  ToolInvocationResponse,
  ToolResult,
  WebSocketMessage,
  WebSocketMessageType,
  ZeroClawClient,
  ZeroClawWebSocket,
};
