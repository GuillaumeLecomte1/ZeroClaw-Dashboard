/**
 * ZeroClaw API TypeScript Type Definitions
 */

// ============================================
// Configuration Types
// ============================================

export interface ZeroClawClientConfig {
  /** Base URL for the ZeroClaw API */
  baseUrl: string;
  /** Authentication token (will be used in Bearer header) */
  token: string;
  /** Optional timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export interface WebSocketConfig {
  /** WebSocket URL for streaming */
  url: string;
  /** Authentication token for WebSocket connection */
  token: string;
  /** Reconnection delay in ms (default: 3000) */
  reconnectDelay?: number;
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
}

// ============================================
// Chat/Response Types (POST /v1/responses)
// ============================================

export interface ChatRequest {
  /** The message text to send */
  text: string;
  /** Optional conversation ID for context */
  conversationId?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  /** Unique message identifier */
  id: string;
  /** Message content */
  content: string;
  /** Message role (user/assistant/system) */
  role: 'user' | 'assistant' | 'system';
  /** Timestamp when message was created */
  timestamp: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  /** Unique response identifier */
  id: string;
  /** The assistant's response text */
  message: string;
  /** Conversation ID if applicable */
  conversationId?: string;
  /** Array of messages in the conversation */
  messages?: ChatMessage[];
  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Timestamp of the response */
  timestamp: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================
// Tool Invocation Types (POST /tools/invoke)
// ============================================

export interface ToolInvocationRequest {
  /** Name of the tool to invoke */
  toolName: string;
  /** Arguments to pass to the tool */
  args: Record<string, unknown>;
  /** Optional invocation ID for tracking */
  invocationId?: string;
}

export interface ToolResult {
  /** Tool name that was invoked */
  toolName: string;
  /** Result data from the tool */
  result: unknown;
  /** Whether the tool execution was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

export interface ToolInvocationResponse {
  /** Unique invocation identifier */
  invocationId: string;
  /** Tool name that was invoked */
  toolName: string;
  /** Result of the tool execution */
  result: unknown;
  /** Whether the execution was successful */
  success: boolean;
  /** Error details if failed */
  error?: {
    code: string;
    message: string;
  };
  /** Execution duration in milliseconds */
  duration?: number;
  /** Timestamp of the response */
  timestamp: string;
}

// ============================================
// WebSocket Types
// ============================================

export type WebSocketMessageType = 
  | 'message' 
  | 'delta' 
  | 'error' 
  | 'connected' 
  | 'disconnected'
  | 'tool_invocation'
  | 'tool_result';

export interface WebSocketBaseMessage {
  /** Message type */
  type: WebSocketMessageType;
  /** Timestamp of the message */
  timestamp: string;
}

export interface WebSocketTextMessage extends WebSocketBaseMessage {
  type: 'message' | 'delta';
  /** Text content of the message */
  content: string;
  /** Optional message ID */
  messageId?: string;
  /** Optional conversation ID */
  conversationId?: string;
}

export interface WebSocketErrorMessage extends WebSocketBaseMessage {
  type: 'error';
  /** Error code */
  code: string;
  /** Error message */
  message: string;
}

export interface WebSocketConnectedMessage extends WebSocketBaseMessage {
  type: 'connected';
  /** Connection session ID */
  sessionId: string;
}

export interface WebSocketDisconnectedMessage extends WebSocketBaseMessage {
  type: 'disconnected';
  /** Reason for disconnection */
  reason?: string;
}

export interface WebSocketToolInvocationMessage extends WebSocketBaseMessage {
  type: 'tool_invocation';
  /** Tool invocation request */
  invocation: ToolInvocationRequest;
}

export interface WebSocketToolResultMessage extends WebSocketBaseMessage {
  type: 'tool_result';
  /** Tool result */
  result: ToolResult;
}

export type WebSocketMessage =
  | WebSocketTextMessage
  | WebSocketErrorMessage
  | WebSocketConnectedMessage
  | WebSocketDisconnectedMessage
  | WebSocketToolInvocationMessage
  | WebSocketToolResultMessage;

export type WebSocketMessageHandler = (message: WebSocketMessage) => void;
export type WebSocketErrorHandler = (error: Error) => void;
export type WebSocketConnectionHandler = (sessionId: string) => void;

// ============================================
// Client Instance Type
// ============================================

export interface ZeroClawClient {
  /** Send a chat message and get a response */
  sendMessage(text: string, options?: { conversationId?: string; metadata?: Record<string, unknown> }): Promise<ChatResponse>;
  
  /** Invoke a tool and get the result */
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<ToolInvocationResponse>;
  
  /** Connect to WebSocket for streaming */
  connectWebSocket(config?: Partial<WebSocketConfig>): ZeroClawWebSocket;
  
  /** Close the client and clean up resources */
  close(): void;
}

export interface ZeroClawWebSocket {
  /** Connect to the WebSocket server */
  connect(): void;
  
  /** Disconnect from the WebSocket server */
  disconnect(): void;
  
  /** Check if currently connected */
  isConnected(): boolean;
  
  /** Send a text message through WebSocket */
  sendMessage(content: string): void;
  
  /** Send a tool invocation through WebSocket */
  sendToolInvocation(toolName: string, args: Record<string, unknown>): void;
  
  /** Set handler for text/delta messages */
  onTextMessage(handler: WebSocketMessageHandler): void;
  
  /** Set handler for errors */
  onError(handler: WebSocketErrorHandler): void;
  
  /** Set handler for connection */
  onConnected(handler: WebSocketConnectionHandler): void;
  
  /** Set handler for disconnection */
  onDisconnected(handler: (reason?: string) => void): void;
  
  /** Set handler for tool invocations */
  onToolInvocation(handler: (invocation: ToolInvocationRequest) => void): void;
  
  /** Set handler for tool results */
  onToolResult(handler: (result: ToolResult) => void): void;
}
