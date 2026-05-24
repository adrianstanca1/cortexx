import React from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: 'chevron' | 'slash' | 'arrow';
  size?: 'sm' | 'md';
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  separator: _separator = 'chevron',
  size = 'md',
  className = '',
}) => {

  return (
    <div className={`text-sm breadcrumbs ${size === 'sm' ? 'text-xs' : ''} ${className}`}>
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            {item.href ? (
              <a href={item.href} onClick={item.onClick}>
                {item.label}
              </a>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
