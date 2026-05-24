import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'bordered' | 'ghost' | 'underlined';
  inputSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  variant = 'bordered',
  inputSize = 'md',
  fullWidth = true,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  const variantClasses = {
    bordered: 'input-bordered',
    ghost: 'input-ghost',
    underlined: 'input-underline',
  }[variant];

  const sizeClasses = {
    sm: 'input-sm',
    md: 'input-md',
    lg: 'input-lg',
  }[inputSize];

  const errorClasses = error ? 'input-error' : '';

  const inputClasses = [
    'input',
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
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50">
            {leftIcon}
          </span>
        )}
        <input className={`${inputClasses} ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''}`} {...props} />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50">
            {rightIcon}
          </span>
        )}
      </div>
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
