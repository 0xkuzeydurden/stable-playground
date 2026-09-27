/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2F80ED',
        accent: '#56CCF2',
        bg: '#0B0D12',
        surface: '#0F141A',
        surface2: '#12202A',
        text: '#E0E6EB',
        muted: '#94A3B8',
      },
    },
  },
  plugins: [],
};
