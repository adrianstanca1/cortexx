import React from 'react';

interface BadgeProps {
  variant?: 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  outline?: boolean;
  ghost?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  outline = false,
  ghost = false,
  children,
  className = '',
  onClick,
}) => {
  const classes = [
    'badge',
    variant ? `badge-${variant}` : '',
    size ? `badge-${size}` : '',
    outline ? 'badge-outline' : '',
    ghost ? 'badge-ghost' : '',
    onClick ? 'cursor-pointer hover:opacity-80' : '',
    className,
  ].filter(Boolean).join(' ').trim();

  return (
    <span className={classes} onClick={onClick}>
      {children}
    </span>
  );
};
