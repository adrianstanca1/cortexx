import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect' | 'rounded';
  width?: string | number;
  height?: string | number;
  className?: string;
  animation?: 'pulse' | 'shimmer';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  animation = 'shimmer',
}) => {
  const variantClasses = {
    text: 'rounded',
    circle: 'rounded-full',
    rect: 'rounded-none',
    rounded: 'rounded-lg',
  }[variant];

  const animationClasses = animation === 'shimmer' ? 'animate-pulse' : 'animate-pulse';

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'string' ? width : `${width}px`;
  if (height) style.height = typeof height === 'string' ? height : `${height}px`;

  return (
    <div
      className={`skeleton ${variantClasses} ${animationClasses} ${className}`}
      style={style}
    />
  );
};
