/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        maroc: {
          rouge: '#C1272D',
          vert: '#006233',
          sable: '#F5F1E8',
          nuit: '#0F1B2D',
        },
        brand: {
          50: '#eef6ff', 100: '#d9eaff', 200: '#bcdbff', 300: '#8ec4ff',
          400: '#59a2ff', 500: '#327dff', 600: '#1b5ef5', 700: '#1449e1',
          800: '#173cb6', 900: '#19388f', 950: '#142457',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
