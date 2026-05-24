import React from 'react';

interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info';
  toggleSize?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  variant = 'primary',
  toggleSize = 'md',
  className = '',
  ...props
}) => {
  const variantClasses = variant ? `toggle-${variant}` : '';
  const sizeClasses = toggleSize ? `toggle-${toggleSize}` : '';

  const classes = [
    'toggle',
    variantClasses,
    sizeClasses,
    className,
  ].filter(Boolean).join(' ').trim();

  return (
    <label className="label cursor-pointer gap-3">
      {label && <span className="label-text">{label}</span>}
      <input type="checkbox" className={classes} {...props} />
    </label>
  );
};
