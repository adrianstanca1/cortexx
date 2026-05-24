import React, { useEffect, useState, useRef } from 'react';
import { buildWebSocketUrl } from '../../lib/wsUrl';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'disabled';

interface WebSocketStatusProps {
  url?: string;
  onStatusChange?: (status: ConnectionStatus) => void;
}

export function WebSocketStatus({ url = '/ws', onStatusChange }: WebSocketStatusProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const failedAttemptsRef = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let wasEverOpen = false;

    const connect = () => {
      const wsUrl = buildWebSocketUrl(url);

      setStatus('connecting');
      wasEverOpen = false;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        wasEverOpen = true;
        failedAttemptsRef.current = 0;
        setStatus('connected');
        onStatusChange?.('connected');
      };

      socket.onclose = (event) => {
        setStatus('disconnected');
        onStatusChange?.('disconnected');

        // If the connection was never opened (code 1006 = abnormal closure),
        // the server likely rejected the WS upgrade because it's disabled.
        // Stop reconnecting after 3 failed attempts.
        if (!wasEverOpen && event.code === 1006) {
          failedAttemptsRef.current++;
          if (failedAttemptsRef.current >= 3) {
            setStatus('disabled');
            onStatusChange?.('disabled');
            return;
          }
        }

        reconnectTimeout = setTimeout(connect, 5000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, [url, onStatusChange]);

  const statusConfig: Record<ConnectionStatus, { color: string; label: string; dotColor: string }> = {
    connected: {
      color: 'bg-green-500',
      label: 'Connected',
      dotColor: 'bg-green-400',
    },
    connecting: {
      color: 'bg-yellow-500',
      label: 'Connecting...',
      dotColor: 'bg-yellow-400 animate-pulse',
    },
    disconnected: {
      color: 'bg-red-500',
      label: 'Disconnected',
      dotColor: 'bg-red-400',
    },
    disabled: {
      color: 'bg-gray-400',
      label: 'Real-time disabled',
      dotColor: 'bg-gray-400',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
      <span className="text-xs text-gray-600">{config.label}</span>
    </div>
  );
}
