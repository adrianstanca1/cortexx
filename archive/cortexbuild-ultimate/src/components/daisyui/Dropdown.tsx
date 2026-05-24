import React, { useState } from 'react';

interface DropdownItem {
  label: string;
  onClick?: () => void;
  divider?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  position?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'left' | 'right';
  variant?: 'dropdown' | 'dropdown-end' | 'dropdown-top' | 'dropdown-bottom';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  position = 'bottom-start',
  variant: _variant = 'dropdown',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const positionClasses = {
    'bottom-start': 'dropdown-start',
    'bottom-end': 'dropdown-end',
    'top-start': 'dropdown-start dropdown-top',
    'top-end': 'dropdown-end dropdown-top',
    'left': 'dropdown-left',
    'right': 'dropdown-right',
  }[position];

  return (
    <div className={`dropdown ${positionClasses} ${className}`}>
      <div
        tabIndex={0}
        role="button"
        className="m-1"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setIsOpen(false)}
      >
        {trigger}
      </div>
      <ul
        tabIndex={0}
        className={`dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 ${isOpen ? 'block' : 'hidden'}`}
      >
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {item.divider ? (
              <li className="menu-divider"></li>
            ) : (
              <li>
                <a
                  className={item.disabled ? 'text-base-content/30 pointer-events-none' : ''}
                  onClick={() => {
                    item.onClick?.();
                    setIsOpen(false);
                  }}
                >
                  {item.label}
                </a>
              </li>
            )}
          </React.Fragment>
        ))}
      </ul>
    </div>
  );
};
