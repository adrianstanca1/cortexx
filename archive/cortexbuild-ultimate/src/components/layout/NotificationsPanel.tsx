// Notifications Panel — CortexBuild Ultimate
// Real-time notifications from WebSocket
import { useState } from 'react';
import {
  Bell, X, Check, CheckCheck, Trash2, Shield,
  TrendingUp, AlertTriangle, Info, MessageSquare,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

interface NotificationsPanelProps {
  authToken: string | null;
  onClose: () => void;
}

const SEVERITY_ICONS: Record<string, React.ElementType> = {
  critical: AlertTriangle,
  error: AlertTriangle,
  warning: TrendingUp,
  info: Info,
  success: Check,
  alert: Shield,
  notification: Bell,
  dashboard_update: TrendingUp,
  collaboration: MessageSquare,
  system: Info,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--red-400)',
  error: 'var(--red-400)',
  warning: 'var(--amber-400)',
  info: 'var(--blue-400)',
  success: 'var(--emerald-400)',
  alert: 'var(--orange-400)',
};

export function NotificationsPanel({ authToken, onClose }: NotificationsPanelProps) {
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
  } = useNotifications(authToken);

  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  const filtered = notifications.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (filter === 'critical' && !['critical', 'error', 'alert'].includes(n.severity)) return false;
    return true;
  });

  return (
    <div
      className="card"
      style={{
        position: 'fixed',
        top: '70px',
        right: '20px',
        width: '420px',
        maxHeight: '80vh',
        background: 'var(--slate-900)',
        border: '1px solid var(--slate-700)',
        borderRadius: '12px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 18px',
        borderBottom: '1px solid var(--slate-800)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--slate-850)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bell style={{ width: '20px', height: '20px', color: 'var(--amber-400)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, color: 'var(--slate-50)' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="badge badge-amber" style={{ marginLeft: '4px' }}>
              {unreadCount}
            </span>
          )}
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? 'var(--emerald-400)' : 'var(--red-400)',
            boxShadow: isConnected ? '0 0 8px var(--emerald-400)' : 'none',
          }} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'var(--slate-800)',
              border: '1px solid var(--slate-700)',
              color: unreadCount > 0 ? 'var(--slate-300)' : 'var(--slate-600)',
              cursor: unreadCount > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-body)',
            }}
          >
            <CheckCheck style={{ width: '14px', height: '14px' }} />
            Mark all
          </button>
          <button
            onClick={clearAll}
            disabled={notifications.length === 0}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'var(--slate-800)',
              border: '1px solid var(--slate-700)',
              color: notifications.length > 0 ? 'var(--slate-300)' : 'var(--slate-600)',
              cursor: notifications.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Trash2 style={{ width: '14px', height: '14px' }} />
            Clear
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'transparent',
              border: '1px solid var(--slate-700)',
              color: 'var(--slate-400)',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        padding: '10px 18px',
        borderBottom: '1px solid var(--slate-800)',
        display: 'flex',
        gap: '8px',
      }}>
        {(['all', 'unread', 'critical'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: filter === f ? 'rgba(245,158,11,0.15)' : 'var(--slate-800)',
              border: `1px solid ${filter === f ? 'rgba(245,158,11,0.3)' : 'var(--slate-700)'}`,
              color: filter === f ? 'var(--amber-400)' : 'var(--slate-400)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--slate-500)',
          }}>
            <Bell style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--slate-400)' }}>
              No notifications
            </p>
          </div>
        ) : (
          filtered.map(notification => {
            const Icon = SEVERITY_ICONS[notification.type] || Info;
            const color = SEVERITY_COLORS[notification.severity] || 'var(--slate-400)';

            return (
              <div
                key={notification.id}
                className="card-hover"
                style={{
                  padding: '14px',
                  marginBottom: '8px',
                  background: notification.read ? 'var(--slate-900)' : 'var(--slate-850)',
                  border: `1px solid ${notification.read ? 'var(--slate-800)' : color}`,
                  borderRadius: '10px',
                  position: 'relative',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: `${color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon style={{ width: '18px', height: '18px', color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--slate-50)',
                      }}>
                        {notification.title}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        color: 'var(--slate-500)',
                      }}>
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '12px',
                      color: 'var(--slate-300)',
                      marginBottom: '8px',
                      lineHeight: 1.4,
                    }}>
                      {notification.description}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'var(--slate-800)',
                            border: '1px solid var(--slate-700)',
                            color: 'var(--slate-300)',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontFamily: 'var(--font-body)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Check style={{ width: '12px', height: '12px' }} />
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() => dismissNotification(notification.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'transparent',
                          border: '1px solid var(--slate-700)',
                          color: 'var(--slate-500)',
                          cursor: 'pointer',
                          fontSize: '10px',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
