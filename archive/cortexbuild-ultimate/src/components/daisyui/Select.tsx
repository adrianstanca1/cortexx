import React from 'react';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  placeholder?: string;
  variant?: 'bordered' | 'ghost' | 'underlined';
  selectSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  options,
  placeholder,
  variant = 'bordered',
  selectSize = 'md',
  fullWidth = true,
  className = '',
  ...props
}) => {
  const variantClasses = {
    bordered: 'select-bordered',
    ghost: 'select-ghost',
    underlined: 'select-underline',
  }[variant];

  const sizeClasses = {
    sm: 'select-sm',
    md: 'select-md',
    lg: 'select-lg',
  }[selectSize];

  const errorClasses = error ? 'select-error' : '';

  const selectClasses = [
    'select',
    variantClasses,
    sizeClasses,
    errorClasses,
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="form-control w-full">
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}
      <select className={selectClasses} {...props}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <label className="label">
          <span className="label-text-alt text-error">{error}</span>
        </label>
      )}
      {helperText && !error && (
        <label className="label">
          <span className="label-text-alt text-base-content/50">{helperText}</span>
        </label>
      )}
    </div>
  );
};
