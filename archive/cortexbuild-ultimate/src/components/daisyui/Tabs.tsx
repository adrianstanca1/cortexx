import React from 'react';

interface Tab {
  id: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface TabsProps {
  tabs: Tab[];
  variant?: 'tabs' | 'tabs-boxed' | 'tabs-lifted' | 'tabs-bordered';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  variant = 'tabs-boxed',
  size = 'md',
  className = '',
}) => {
  const classes = [variant, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="tablist">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          role="tab"
          className={`tab ${tab.active ? 'tab-active' : ''} ${size === 'sm' ? 'tab-sm' : size === 'lg' ? 'tab-lg' : ''} ${tab.disabled ? 'tab-disabled' : ''}`}
          onClick={() => !tab.disabled && tab.onClick?.()}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
};
