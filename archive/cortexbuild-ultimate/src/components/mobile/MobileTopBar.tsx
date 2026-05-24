import { Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MobileTopBarProps {
  notificationCount?: number;
  onNotificationsClick?: () => void;
}

export function MobileTopBar({ notificationCount = 0, onNotificationsClick }: MobileTopBarProps) {
  const { user } = useAuth();
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-slate-800 border-b border-slate-700 flex-shrink-0">
      <div>
        <div className="text-slate-400 text-[10px] uppercase tracking-widest">Project</div>
        <div className="text-slate-100 text-sm font-semibold truncate max-w-[180px]">
          {user?.company ?? 'CortexBuild'}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onNotificationsClick}
          className="relative p-1"
          aria-label="Notifications"
        >
          <Bell size={20} className="text-slate-300" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[9px] px-1 leading-4 min-w-[16px] text-center">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
      </div>
    </header>
  );
}
