import { useEffect, useState } from 'react';

interface UserPresence {
  userId: string;
  userName: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: string;
}

interface PresenceIndicatorProps {
  users: UserPresence[];
  size?: 'sm' | 'md' | 'lg';
}

export function PresenceIndicator({ users, size = 'md' }: PresenceIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const statusColors = {
    online: 'bg-success',
    away: 'bg-warning',
    busy: 'bg-error',
    offline: 'bg-gray-400',
  };

  return (
    <div className="flex -space-x-2">
      {users.slice(0, 5).map(user => (
        <div
          key={user.userId}
          className="relative"
          title={`${user.userName} - ${user.status}`}
        >
          <div className={`w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-content text-sm font-bold border-2 border-base-100`}>
            {user.userName[0]}
          </div>
          <div
            className={`absolute bottom-0 right-0 ${sizeClasses[size]} ${statusColors[user.status]} rounded-full border-2 border-base-100`}
          />
        </div>
      ))}
      {users.length > 5 && (
        <div className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center text-xs font-medium border-2 border-base-100">
          +{users.length - 5}
        </div>
      )}
    </div>
  );
}

// Hook for real-time presence
export function usePresence(roomId: string) {
  const [users, setUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    // Simulate presence updates (replace with WebSocket)
    const mockUsers: UserPresence[] = [
      { userId: '1', userName: 'Sarah Chen', status: 'online' },
      { userId: '2', userName: 'James Miller', status: 'busy' },
      { userId: '3', userName: 'Patricia Watson', status: 'away' },
    ];
    setUsers(mockUsers);

    // Simulate presence changes
    const interval = setInterval(() => {
      setUsers(prev => prev.map(u => ({
        ...u,
        status: Math.random() > 0.5 ? 'online' : u.status,
      })));
    }, 10000);

    return () => clearInterval(interval);
  }, [roomId]);

  return { users, onlineCount: users.filter(u => u.status === 'online').length };
}
