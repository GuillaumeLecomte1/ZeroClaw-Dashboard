import { useState, useCallback, useRef } from 'react';
import { createZeroClawClient } from '../lib/zeroclaw-client';
import type { ChatMessage } from '../lib/types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import './ChatWindow.css';

const client = createZeroClawClient();

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: text,
      role: 'user',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await client.sendMessage(text, {
        conversationId: conversationIdRef.current,
      });

      conversationIdRef.current = response.conversationId;

      const assistantMessage: ChatMessage = {
        id: response.id,
        content: response.message,
        role: 'assistant',
        timestamp: response.timestamp,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        content: `Error: ${errorMessage}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    conversationIdRef.current = undefined;
  }, []);

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-info">
          <h2>ZeroClaw AI</h2>
          <span className="chat-status">
            <span className="status-dot"></span>
            Online
          </span>
        </div>
        {messages.length > 0 && (
          <button className="clear-chat-button" onClick={clearChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear Chat
          </button>
        )}
      </div>

      <MessageList messages={messages} isStreaming={isLoading} />

      {error && (
        <div className="chat-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </div>
      )}

      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
