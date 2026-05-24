import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, apiPost } from "@/lib/api";

interface DocumentVersion {
  id: string;
  content: string;
  userId: string;
  userName: string;
  timestamp: string;
}

interface Collaborator {
  clientId: string;
  userId: string;
  userName: string;
  cursorPos: number | null;
  idle: boolean;
}

interface UseCollaborativeEditorResult {
  content: string;
  updateContent: (newContent: string) => void;
  versions: DocumentVersion[];
  saveVersion: () => Promise<void>;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  collaborators: Collaborator[];
  presence: Collaborator[];
  connectionStatus: "connecting" | "connected" | "disconnected";
  loading: boolean;
  error: Error | null;
}

/**
 * Collaborative document editor hook.
 *
 * **Real-time Collaboration**: Connects to WebSocket `/ws/documents/:id`.
 * - Local ops are optimistically applied and sent to server
 * - Remote ops are timestamp-ordered (last-write-wins)
 * - Presence (cursor, idle status) is broadcast to all clients
 * - Initial load via REST API; subsequent edits sync via WebSocket
 */
export function useCollaborativeEditor(
  documentId: string,
): UseCollaborativeEditorResult {
  const [content, setContent] = useState("");
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [presence, setPresence] = useState<Collaborator[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string>("");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load document content and version history
  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const doc = await apiGet<{
          content: string;
          versions: DocumentVersion[];
        }>(`/documents/${documentId}`);
        if (cancelled) return;
        setContent(doc.content ?? "");
        setVersions(doc.versions ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err : new Error("Failed to load document"),
        );
        console.error("[useCollaborativeEditor] Load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // WebSocket collaboration
  useEffect(() => {
    if (!documentId) return;
    // Tests provide a global WebSocket mock; production uses the browser's.
    if (typeof WebSocket === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/documents/${documentId}`;

    setConnectionStatus("connecting");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");

      // Start heartbeat to reset idle timer on server
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25_000); // Every 25s (slightly less than server's 30s heartbeat)
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWSMessage(message);
      } catch (err) {
        console.error("[useCollaborativeEditor] Message parse error:", err);
      }
    };

    ws.onerror = (event) => {
      console.error("[useCollaborativeEditor] WebSocket error:", event);
      setError(new Error("WebSocket connection error"));
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
    // handleWSMessage is intentionally excluded — it only calls setState
    // (stable across renders) and including it would tear down + reopen the
    // WS on every render, which is not what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Handle incoming WebSocket messages
  const handleWSMessage = useCallback((message: Record<string, unknown>) => {
    const { type } = message;

    switch (type) {
      case "welcome": {
        // Server confirmed connection and sent presence list
        clientIdRef.current = message.clientId as string;
        setPresence(message.presence as Collaborator[]);
        break;
      }

      case "remote_op": {
        // Remote client sent an operation
        // Last-write-wins: server timestamp determines canonical order
        // Clients could apply transform, but for simplicity just accept it
        const op = message.op as Record<string, unknown>;
        if (op.type === "insert" && typeof op.content === "string") {
          // Optimistic: server handles ordering; we just apply
          setContent((prev) => {
            const pos = (op.position as number) || 0;
            return prev.slice(0, pos) + op.content + prev.slice(pos);
          });
        } else if (op.type === "delete") {
          const pos = (op.position as number) || 0;
          const len = typeof op.length === "number" ? op.length : 0;
          setContent((prev) => prev.slice(0, pos) + prev.slice(pos + len));
        }
        break;
      }

      case "presence_update": {
        // Presence list changed (cursor positions, idle, etc.)
        setPresence(message.presence as Collaborator[]);
        break;
      }

      case "error": {
        const msg = message.message as string;
        console.error("[useCollaborativeEditor] Server error:", msg);
        setError(new Error(msg));
        break;
      }

      default: {
        console.warn("[useCollaborativeEditor] Unknown message type:", type);
      }
    }
  }, []);

  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent);

      // Broadcast operation to other clients
      if (
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        wsRef.current.send(
          JSON.stringify({
            type: "op",
            op: {
              type: "replace",
              content: newContent,
              timestamp: Date.now(),
            },
            cursorPos: 0, // Would be actual cursor position in real impl
          })
        );
      }
    },
    []
  );

  const saveVersion = useCallback(async () => {
    if (!documentId || !content.trim()) return;
    try {
      const version: DocumentVersion = {
        id: crypto.randomUUID?.() ?? Date.now().toString(),
        content: content.substring(0, 200),
        userId: "current-user",
        userName: "You",
        timestamp: new Date().toISOString(),
      };

      await apiPost(`/documents/${documentId}/versions`, {
        content: version.content,
        fullContent: content,
      });

      setVersions((prev) => [version, ...prev]);
    } catch (err) {
      console.error("[useCollaborativeEditor] Save failed:", err);
      throw err instanceof Error
        ? err
        : new Error("Failed to save document version");
    }
  }, [documentId, content]);

  return {
    content,
    updateContent,
    versions,
    saveVersion,
    isEditing,
    setIsEditing,
    collaborators: presence,
    presence,
    connectionStatus,
    loading,
    error,
  };
}
