import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info';
  checkboxSize?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  variant = 'primary',
  checkboxSize = 'md',
  className = '',
  ...props
}) => {
  const variantClasses = variant ? `checkbox-${variant}` : '';
  const sizeClasses = checkboxSize ? `checkbox-${checkboxSize}` : '';

  const classes = [
    'checkbox',
    variantClasses,
    sizeClasses,
    className,
  ].filter(Boolean).join(' ').trim();

  return (
    <label className="label cursor-pointer gap-3">
      <input type="checkbox" className={classes} {...props} />
      {label && <span className="label-text">{label}</span>}
    </label>
  );
};
