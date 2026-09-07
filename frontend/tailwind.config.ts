import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#effaf4',
          100: '#d9f4e3',
          200: '#b7e9cb',
          300: '#82d8a9',
          400: '#46c383',
          500: '#0d9f62',
          600: '#087f4d',
          700: '#07643e',
          800: '#075034',
          900: '#063f2b',
          950: '#032619',
        },
        surface: {
          DEFAULT: '#f7f9f8',
          card: '#ffffff',
          border: '#e2e8e5',
          hover: '#f0f5f2',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
