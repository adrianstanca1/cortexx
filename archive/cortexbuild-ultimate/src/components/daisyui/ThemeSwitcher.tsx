import React, { useState, useEffect } from 'react';

interface ThemeSwitcherProps {
  themes?: string[];
  className?: string;
}

const THEME_ICONS: Record<string, string> = {
  light: '☀️',
  dark: '🌙',
  corporate: '💼',
  synthwave: '🌆',
  cyberpunk: '🤖',
  dracula: '🧛',
  nord: '❄️',
  sunset: '🌅',
  cortexbuild: '🏗️',
  'cortex-light': '🏢',
  ocean: '🌊',
};

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  themes = [
    'light',
    'dark',
    'corporate',
    'synthwave',
    'cyberpunk',
    'dracula',
    'nord',
    'sunset',
    'cortexbuild',
    'cortex-light',
    'ocean',
  ],
  className = '',
}) => {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'cortexbuild';
    }
    return 'cortexbuild';
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme);
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    setIsOpen(false);
  };

  return (
    <div className={`dropdown dropdown-end ${className}`}>
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-circle"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setIsOpen(false)}
      >
        <span className="text-xl" title="Theme">
          {THEME_ICONS[currentTheme] || '🎨'}
        </span>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 rounded-box w-52 max-h-96 overflow-y-auto"
        style={{ display: isOpen ? 'block' : 'none' }}
      >
        <li className="menu-title">
          <span>Themes</span>
        </li>
        {themes.map((theme) => (
          <li key={theme}>
            <a
              className={currentTheme === theme ? 'active' : ''}
              onClick={() => handleThemeChange(theme)}
            >
              <span className="text-lg mr-2">{THEME_ICONS[theme] || '🎨'}</span>
              <span className="capitalize">{theme.replace('-', ' ')}</span>
              {currentTheme === theme && (
                <span className="badge badge-primary badge-sm ml-auto">✓</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
