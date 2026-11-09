import type { Config } from 'tailwindcss'

// "Almanac Heritage" design system — deep forest green + burnt terracotta on
// warm cream paper. Source of truth: the LandEthic Almanac Redesign canvas.
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paper + ink
        cream:        { DEFAULT: '#FBF6EC', 2: '#F4EBD9' },
        'paper-line': '#E1D3B3',
        ink:          { DEFAULT: '#2A2116', soft: '#6B5D48', faint: '#9C8E76' },
        // Forest greens
        forest: {
          900: '#173404',
          800: '#27500A',
          700: '#3B6D11',
          600: '#639922',
          200: '#C0DD97',
          50:  '#EAF3DE',
        },
        // Burnt terracotta accents
        rust: { 700: '#8F3412', 600: '#B5501C', 100: '#F7DDCB' },
        // Legacy names kept so older class names still resolve
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
        sans:    ['var(--font-public-sans)', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-arvo)', 'Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
