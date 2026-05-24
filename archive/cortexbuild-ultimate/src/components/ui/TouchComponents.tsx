import { type ButtonHTMLAttributes } from 'react';

// Touch-optimized button with larger hit area
interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function TouchButton({ 
  children, 
  variant = 'primary', 
  size = 'lg',
  className = '',
  ...props 
}: TouchButtonProps) {
  const baseClasses = 'btn font-medium transition-all active:scale-95';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-error',
  };
  const sizeClasses = {
    sm: 'btn-md min-h-[48px]',
    md: 'btn-lg min-h-[52px]',
    lg: 'btn-lg min-h-[56px]',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Touch-optimized list item
interface TouchListItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  chevron?: boolean;
}

export function TouchListItem({ children, onClick, icon, chevron = true }: TouchListItemProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-4 min-h-[64px] hover:bg-base-200 active:bg-base-300 cursor-pointer border-b border-base-300"
    >
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <div className="flex-1">{children}</div>
      {chevron && (
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );
}

// Swipeable card for mobile
interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function SwipeableCard({ children, onSwipeLeft, onSwipeRight }: SwipeableCardProps) {
  const handleTouchStart = (e: React.TouchEvent) => {
    const startX = e.touches[0].clientX;
    
    const handleTouchMove = (e: TouchEvent) => {
      const diffX = e.touches[0].clientX - startX;
      if (Math.abs(diffX) > 100) {
        if (diffX > 0 && onSwipeRight) onSwipeRight();
        if (diffX < 0 && onSwipeLeft) onSwipeLeft();
        document.removeEventListener('touchmove', handleTouchMove);
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', () => {
      document.removeEventListener('touchmove', handleTouchMove);
    }, { once: true });
  };

  return (
    <div 
      className="card bg-base-100 shadow-sm touch-pan-y"
      onTouchStart={handleTouchStart}
    >
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}
