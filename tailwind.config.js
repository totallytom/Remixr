/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50, #f0f9ff)',
          100: 'var(--color-primary-100, #e0f2fe)',
          200: 'var(--color-primary-200, #bae6fd)',
          300: 'var(--color-primary-300, #7dd3fc)',
          400: 'var(--color-primary-400, #38bdf8)',
          500: 'var(--color-primary-500, #0ea5e9)',
          600: 'var(--color-primary-600, #0284c7)',
          700: 'var(--color-primary-700, #0369a1)',
          800: 'var(--color-primary-800, #075985)',
          900: 'var(--color-primary-900, #0c4a6e)',
          DEFAULT: 'var(--color-primary)',
        },
        secondary: {
          50: 'var(--color-secondary-50, #fdf4ff)',
          100: 'var(--color-secondary-100, #fae8ff)',
          200: 'var(--color-secondary-200, #f5d0fe)',
          300: 'var(--color-secondary-300, #f0abfc)',
          400: 'var(--color-secondary-400, #e879f9)',
          500: 'var(--color-secondary-500, #d946ef)',
          600: 'var(--color-secondary-600, #c026d3)',
          700: 'var(--color-secondary-700, #a21caf)',
          800: 'var(--color-secondary-800, #86198f)',
          900: 'var(--color-secondary-900, #701a75)',
          DEFAULT: 'var(--color-secondary)',
        },
        dark: {
          50: 'var(--color-dark-50, #f8fafc)',
          100: 'var(--color-dark-100, #f1f5f9)',
          200: 'var(--color-dark-200, #e2e8f0)',
          300: 'var(--color-dark-300, #cbd5e1)',
          400: 'var(--color-dark-400, #94a3b8)',
          500: 'var(--color-dark-500, #64748b)',
          600: 'var(--color-dark-600, #475569)',
          700: 'var(--color-dark-700, #334155)',
          800: 'var(--color-dark-800, #1e293b)',
          900: 'var(--color-dark-900, #0f172a)',
        },
        // Theme-specific colors
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        text: 'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        warm: 'var(--color-warm)',
        glow: 'var(--color-glow)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        kotra: ['KOTRA_BOLD-Bold', 'sans-serif'],
        kyobo: ['KyoboHand', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} 