import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // Local dev: the same Hono app runs standalone on 8787 (see server/dev.ts),
      // so the client hits an identical code path to production.
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
