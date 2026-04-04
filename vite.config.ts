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
          'solana': ['@solana/web3.js', '@solana/spl-token'],
          'wallet-adapter': ['@solana/wallet-adapter-react', '@solana/wallet-adapter-wallets'],
          'firebase': ['firebase/app', 'firebase/analytics', 'firebase/firestore'],
          'lp-orca': ['@orca-so/whirlpools-sdk'],
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
