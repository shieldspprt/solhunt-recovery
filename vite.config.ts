import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
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
      manifest: false, // We use our own public/manifest.webmanifest
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/node_modules/**'],
      },
      devOptions: {
        enabled: false, // SW disabled in dev to avoid caching issues
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Required for @solana/web3.js in browser
    'process.env': {},
    global: 'globalThis',
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core Solana - minimal bundle for connection handling
          'solana-core': ['@solana/web3.js'],
          // SPL Token - separate from core for tree-shaking
          'solana-spl': ['@solana/spl-token'],
          // Wallet adapters - split to reduce initial bundle
          'wallet-adapter-base': ['@solana/wallet-adapter-base'],
          'wallet-adapter-react': ['@solana/wallet-adapter-react', '@solana/wallet-adapter-react-ui'],
          'wallet-adapter-wallets': ['@solana/wallet-adapter-wallets'],
          // Mobile wallet adapter - lazy loaded on mobile detection
          'wallet-mobile': ['@solana-mobile/wallet-adapter-mobile'],
          // Firebase - only used for analytics
          'firebase': ['firebase/app', 'firebase/analytics'],
          // LP SDKs - each isolated to prevent massive single chunks
          'lp-orca-core': ['@orca-so/common-sdk'],
          'lp-orca-pools': ['@orca-so/whirlpools-sdk'],
          'lp-raydium': ['@raydium-io/raydium-sdk-v2'],
          'lp-meteora': ['@meteora-ag/dlmm'],
        },
        // Improved tree-shaking and module optimization
        interop: 'esModule',
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    }
  }
})
