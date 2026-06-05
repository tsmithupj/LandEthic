import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'green-900': '#173404',
        'green-800': '#27500A',
        'green-700': '#3B6D11',
        'green-600': '#639922',
        'green-100': '#C0DD97',
        'green-50':  '#EAF3DE',
        'teal-700':  '#0F6E56',
        'teal-600':  '#1D9E75',
        'teal-50':   '#E1F5EE',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Arial', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
