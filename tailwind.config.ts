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
                    bg: '#09090b',         // Deeper, neutral dark
                    card: '#121214',       // Slightly elevated dark
                    border: '#27272a',     // Crisp subtle borders
                    accent: '#14f195',     // Solana Green
                    success: '#14f195',
                    warning: '#eab308',
                    danger: '#ef4444',
                    text: '#fafafa',       // Bright neutral white
                    muted: '#a1a1aa',      // Neutral gray
                    glow: 'rgba(20, 241, 149, 0.1)',
                    surface: 'rgba(18, 18, 20, 0.6)',
                }
            },
            fontFamily: {
                sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
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
