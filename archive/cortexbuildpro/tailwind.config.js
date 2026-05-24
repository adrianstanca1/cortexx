/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },
        slate: {
          850: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        success: { DEFAULT: "#22c55e", light: "#86efac", dark: "#15803d" },
        warning: { DEFAULT: "#f59e0b", light: "#fcd34d", dark: "#b45309" },
        danger:  { DEFAULT: "#ef4444", light: "#fca5a5", dark: "#b91c1c" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
