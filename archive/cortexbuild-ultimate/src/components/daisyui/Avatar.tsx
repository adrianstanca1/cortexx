import React from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square' | 'rounded';
  online?: boolean;
  offline?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  fallback = '?',
  size = 'md',
  shape = 'circle',
  online = false,
  offline = false,
  className = '',
  onClick,
}) => {
  const sizeClasses = {
    xs: 'w-8',
    sm: 'w-10',
    md: 'w-14',
    lg: 'w-20',
    xl: 'w-28',
  }[size];

  const shapeClasses = {
    circle: 'rounded-full',
    square: 'rounded-none',
    rounded: 'rounded-xl',
  }[shape];

  const statusClasses = online ? 'online' : offline ? 'offline' : '';

  return (
    <div className={`avatar ${statusClasses} ${className}`} onClick={onClick}>
      <div className={`${sizeClasses} ${shapeClasses}`}>
        {src ? (
          <img src={src} alt={alt} />
        ) : (
          <div className="bg-neutral text-neutral-content flex items-center justify-center w-full h-full">
            <span className="text-lg font-semibold">{fallback}</span>
          </div>
        )}
      </div>
    </div>
  );
};
