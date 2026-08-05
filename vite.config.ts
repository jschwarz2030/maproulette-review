import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Allow TEST_* (and default VITE_*) env vars through to import.meta.env
  envPrefix: ['VITE_', 'TEST_'],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    process: JSON.stringify({
      env: {
        NODE_ENV: 'production',
      },
    }),
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'src/__tests__/**/*.{ts,tsx}'],
  },
  build: {
    lib: {
      entry: 'src/plugin.tsx',
      name: 'maprouletteReviewPlugin',
      formats: ['iife'],
      fileName: () => 'maprouletteReviewPlugin.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
  },
  server: {
    host: true,
    port: 4201,
  },
  preview: {
    host: true,
    port: 4201,
  },
})
