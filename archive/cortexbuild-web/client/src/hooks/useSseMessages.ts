import { useEffect, useRef, useState, useCallback } from "react";

export interface SseMessage {
  id: number;
  conversationId: number;
  contactId: number;
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "document" | "audio";
  body: string | null;
  mediaId: number | null;
  isKeySection: boolean;
  keyLabel?: string | null;
  sentAt: string;
  createdAt: string;
}

interface UseSseMessagesReturn {
  liveMessages: SseMessage[];
  isConnected: boolean;
  error: string | null;
}

/**
 * SSE hook for real-time chat messages.
 * Opens an EventSource to /api/sse/messages and accumulates new messages.
 * Auto-reconnects with exponential backoff (max 30s).
 */
export function useSseMessages(conversationId: number | undefined): UseSseMessagesReturn {
  const [liveMessages, setLiveMessages] = useState<SseMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(1000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!conversationId || conversationId === 0) return;

    clearTimer();

    const es = new EventSource(`/api/sse/messages?conversationId=${conversationId}`);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setIsConnected(true);
      setError(null);
      retryDelayRef.current = 1000;
    });

    es.addEventListener("message", (e) => {
      try {
        const msg: SseMessage = JSON.parse(e.data);
        setLiveMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener("error", () => {
      setIsConnected(false);
      es.close();
      esRef.current = null;
      setError("Connection lost. Reconnecting...");

      // Exponential backoff
      const delay = Math.min(retryDelayRef.current, 30_000);
      retryDelayRef.current = delay * 1.5;
      timerRef.current = setTimeout(connect, delay);
    });
  }, [conversationId, clearTimer]);

  useEffect(() => {
    setLiveMessages([]);
    setError(null);
    retryDelayRef.current = 1000;
    connect();

    return () => {
      clearTimer();
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect, clearTimer]);

  return { liveMessages, isConnected, error };
}
