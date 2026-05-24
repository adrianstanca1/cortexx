import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  image?: string;
  imageAlt?: string;
  compact?: boolean;
  bordered?: boolean;
  shadow?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  actions,
  image,
  imageAlt = 'Card image',
  compact = false,
  bordered = false,
  shadow = 'xl',
  children,
  className = '',
  onClick,
}) => {
  const shadowClasses = {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  }[shadow];

  const classes = [
    'card',
    'bg-base-100',
    shadowClasses,
    compact ? 'card-compact' : '',
    bordered ? 'border border-base-300' : '',
    onClick ? 'cursor-pointer hover:bg-base-200 transition-colors' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick}>
      {image && (
        <figure>
          <img src={image} alt={imageAlt} className="w-full h-48 object-cover" />
        </figure>
      )}
      <div className="card-body">
        {(title || subtitle) && (
          <div className="card-title">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {subtitle && <p className="text-sm text-base-content/70">{subtitle}</p>}
          </div>
        )}
        {children}
        {actions && (
          <div className="card-actions justify-end mt-4">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
