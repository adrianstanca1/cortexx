/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg0: '#06101e',
        bg1: '#0c1a2e',
        bg2: '#152641',
        bg3: '#1a2f4e',
        blue: '#2563eb',
        blueL: '#60a5fa',
        green: '#10b981',
        amber: '#f59e0b',
        red: '#ef4444',
        purple: '#8b5cf6',
        cyan: '#06b6d4',
        t1: '#eef3fa',
        t2: '#8ea8c5',
        t3: '#52749a',
      },
      fontFamily: {
        system: ['-apple-system', '"SF Pro Text"', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '390px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
