/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // Custom slate palette for consistency
        slate: {
          950: '#080b12',
          900: '#0d1117',
          850: '#111827',
          800: '#161d2e',
          700: '#1e293b',
          600: '#283548',
          500: '#3d4f66',
          400: '#5a6a82',
          300: '#8a9bb5',
          200: '#b8c4d4',
          100: '#e2e8f0',
          50: '#f1f5f9',
        },
        // Amber primary accent
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Emerald success
        emerald: {
          400: '#34d399',
          500: '#10b981',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fadeIn 0.4s ease both',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.4)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(245, 158, 11, 0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      'light',
      'dark',
      'corporate',
      'synthwave',
      'cyberpunk',
      'dracula',
      'nord',
      'sunset',
      {
        // CortexBuild Ultimate custom theme
        cortexbuild: {
          primary: '#f59e0b',      // Amber 500
          'primary-focus': '#d97706', // Amber 600
          'primary-content': '#080b12',
          secondary: '#3b82f6',    // Brand 500
          'secondary-focus': '#2563eb', // Brand 600
          'secondary-content': '#ffffff',
          accent: '#10b981',       // Emerald 500
          'accent-focus': '#059669',
          'accent-content': '#ffffff',
          neutral: '#1e293b',      // Slate 700
          'neutral-focus': '#0d1117', // Slate 900
          'neutral-content': '#f1f5f9',
          'base-100': '#080b12',   // Slate 950
          'base-200': '#0d1117',   // Slate 900
          'base-300': '#111827',   // Slate 850
          'base-content': '#e2e8f0', // Slate 100
          info: '#3b82f6',
          'info-content': '#ffffff',
          success: '#10b981',
          'success-content': '#ffffff',
          warning: '#f59e0b',
          'warning-content': '#080b12',
          error: '#ef4444',
          'error-content': '#ffffff',
        },
      },
      {
        // Light CortexBuild theme
        'cortex-light': {
          primary: '#d97706',      // Amber 600
          'primary-focus': '#b45309',
          'primary-content': '#ffffff',
          secondary: '#2563eb',    // Brand 600
          'secondary-focus': '#1d4ed8',
          'secondary-content': '#ffffff',
          accent: '#059669',       // Emerald 600
          'accent-focus': '#047857',
          'accent-content': '#ffffff',
          neutral: '#e2e8f0',      // Slate 100
          'neutral-focus': '#b8c4d4', // Slate 200
          'neutral-content': '#1e293b',
          'base-100': '#ffffff',
          'base-200': '#f1f5f9',   // Slate 50
          'base-300': '#e2e8f0',   // Slate 100
          'base-content': '#0d1117',
          info: '#3b82f6',
          'info-content': '#ffffff',
          success: '#10b981',
          'success-content': '#ffffff',
          warning: '#f59e0b',
          'warning-content': '#080b12',
          error: '#ef4444',
          'error-content': '#ffffff',
        },
      },
      {
        // Ocean theme - blue-based color scheme
        ocean: {
          primary: '#0ea5e9',      // Sky 500
          'primary-focus': '#0284c7', // Sky 600
          'primary-content': '#ffffff',
          secondary: '#6366f1',    // Indigo 500
          'secondary-focus': '#4f46e5', // Indigo 600
          'secondary-content': '#ffffff',
          accent: '#10b981',       // Emerald 500
          'accent-focus': '#059669',
          'accent-content': '#ffffff',
          neutral: '#1e293b',      // Slate 700
          'neutral-focus': '#0d1117', // Slate 900
          'neutral-content': '#f1f5f9',
          'base-100': '#0f172a',   // Slate 900
          'base-200': '#1e293b',   // Slate 800
          'base-300': '#334155',   // Slate 700
          'base-content': '#f8fafc', // Slate 50
          info: '#0ea5e9',
          'info-content': '#ffffff',
          success: '#10b981',
          'success-content': '#ffffff',
          warning: '#f59e0b',
          'warning-content': '#080b12',
          error: '#ef4444',
          'error-content': '#ffffff',
        },
      },
    ],
    darkTheme: 'dark',
    base: true,
    styled: true,
    utils: true,
    prefix: '',
    logs: false,
  },
}
