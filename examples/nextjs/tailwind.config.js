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
        blue: {
          400: '#60A5FA',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        purple: {
          400: '#C084FC',
          600: '#9333EA',
        },
        pink: {
          400: '#F472B6',
        },
      },
    },
  },
  plugins: [],
};
