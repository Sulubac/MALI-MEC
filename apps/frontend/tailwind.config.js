/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B4B82', 50: '#EFF4FB', 100: '#DDEAF7', 200: '#BBCFEF', 300: '#89ADDF', 400: '#5386CA', 500: '#2D6AB4', 600: '#1B4B82', 700: '#183F6E', 800: '#17365E', 900: '#162E50' },
        gold: { DEFAULT: '#C9A54A', 50: '#FBF7EE', 100: '#F5EACC', 200: '#EDD699', 300: '#E2BC5C', 400: '#D9A83C', 500: '#C9A54A', 600: '#A88835', 700: '#8A6E2A', 800: '#6F5820', 900: '#5A471A' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], arabic: ['Noto Naskh Arabic', 'serif'] },
      boxShadow: { 'glass': '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)' },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
