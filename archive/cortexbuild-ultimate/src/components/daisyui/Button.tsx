import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'link' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  active?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  square?: boolean;
  circle?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  active = false,
  disabled = false,
  fullWidth = false,
  square = false,
  circle = false,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'btn';
  const variantClasses = variant ? `btn-${variant}` : '';
  const sizeClasses = size ? `btn-${size}` : '';
  const stateClasses = [
    active ? 'btn-active' : '',
    loading ? 'loading' : '',
    disabled ? 'btn-disabled' : '',
  ].filter(Boolean).join(' ');
  const shapeClasses = [
    square ? 'btn-square' : '',
    circle ? 'btn-circle' : '',
    fullWidth ? 'btn-block' : '',
  ].filter(Boolean).join(' ');

  const classes = [baseClasses, variantClasses, sizeClasses, stateClasses, shapeClasses, className]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <span className="loading loading-spinner loading-md"></span>}
      {children}
    </button>
  );
};
