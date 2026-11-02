import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f5f4',
          100: '#e7e5e4',
          200: '#d6d3d1',
          300: '#a8a29e',
          400: '#78716c',
          500: '#57534e',
          600: '#44403c',
          700: '#292524',
          800: '#1c1917',
          900: '#141210',
          950: '#0c0a09',
          DEFAULT: '#141210',
        },
        paper: {
          50: '#fcfaf6',
          100: '#f7f2e8',
          200: '#efe5d2',
          300: '#e5d5b8',
          400: '#d6be96',
          500: '#c5a574',
          DEFAULT: '#f7f2e8',
          dark: '#efe5d2',
        },
        cinnabar: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          DEFAULT: '#b91c1c',
        },
        wood: {
          100: '#ebd8c2',
          300: '#cfa97e',
          500: '#a87844',
          700: '#784f24',
          800: '#5c3716',
          900: '#42240b',
          DEFAULT: '#784f24',
        },
      },
    },
  },
  plugins: [],
};
export default config;
