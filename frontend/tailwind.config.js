/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', 'sans-serif'],
        display: ['"Space Grotesk"', '"Noto Sans SC"', 'sans-serif']
      }
    }
  },
  plugins: []
}
