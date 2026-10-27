/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        navy: {
          50: '#f0f5fa',
          100: '#dce8f3',
          200: '#bdd4ea',
          300: '#8fb7dc',
          400: '#5b93ca',
          500: '#3775b5',
          600: '#275c98',
          700: '#1f497b',
          800: '#193b63',
          900: '#0f2540',
          950: '#091729',
        },
        aqua: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        }
      },
      borderRadius: {
        'card': '12px',
      }
    },
  },
  plugins: [],
};
