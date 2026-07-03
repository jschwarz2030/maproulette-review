import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    process: JSON.stringify({
      env: {
        NODE_ENV: 'production',
      },
    }),
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
