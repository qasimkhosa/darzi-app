/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        saffron: '#f59e0b',
        thread: '#0f766e',
        muslin: '#fff7ed',
      },
      fontFamily: {
        nastaliq: ['NotoNastaliqUrdu'],
        nastaliqBold: ['NotoNastaliqUrduBold'],
      },
    },
  },
  plugins: [],
};
