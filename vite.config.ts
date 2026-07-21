import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// React Compiler — automatic memoization for React 19
// Eliminates manual useMemo/useCallback/React.memo
const ReactCompilerConfig = {
  target: '19',
  sources: (filename: string) => {
    // Only compile app source, skip node_modules
    return filename.includes('src') && !filename.includes('node_modules')
  },
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', ReactCompilerConfig]
        ]
      }
    }),
    nodePolyfills({
      include: ['buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/node_modules/**'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'solana-core': ['@solana/web3.js'],
          'solana-spl': ['@solana/spl-token'],
          'wallet-adapter-base': ['@solana/wallet-adapter-base'],
          'wallet-adapter-react': ['@solana/wallet-adapter-react', '@solana/wallet-adapter-react-ui'],
          'wallet-adapter-wallets': ['@solana/wallet-adapter-wallets'],
          'wallet-mobile': ['@solana-mobile/wallet-adapter-mobile'],
          'firebase': ['firebase/app', 'firebase/analytics'],
          'lp-orca-core': ['@orca-so/common-sdk'],
          'lp-orca-pools': ['@orca-so/whirlpools-sdk'],
          'lp-raydium': ['@raydium-io/raydium-sdk-v2'],
          'lp-meteora': ['@meteora-ag/dlmm'],
        },
        interop: 'esModule',
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    }
  }
})
