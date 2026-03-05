import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                shield: {
                    bg: '#050a12',
                    card: '#0c1220',
                    border: '#162032',
                    accent: '#14f195',
                    success: '#14f195',
                    warning: '#fbbf24',
                    danger: '#f43f5e',
                    text: '#e8edf5',
                    muted: '#5a6578',
                    glow: 'rgba(20, 241, 149, 0.15)',
                    surface: 'rgba(12, 18, 32, 0.7)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            animation: {
                'fade-in-up': 'fadeInUp 0.5s ease-out',
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
                'count-up': 'countUp 1s ease-out',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(20, 241, 149, 0.1)' },
                    '50%': { boxShadow: '0 0 40px rgba(20, 241, 149, 0.25)' },
                },
                countUp: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
        },
    },
    plugins: [],
}

export default config
