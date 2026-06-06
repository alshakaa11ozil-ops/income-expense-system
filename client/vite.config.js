/*
 * ============================================================
 * FILE    : vite.config.js
 * LAYER   : Build / Dev server config
 * PURPOSE : Vite dev server configuration. Proxies all /api/*
 *           requests to the Express backend on port 5000 so
 *           the Axios baseURL '/api' resolves correctly in dev.
 *           Without this, every API call returns an HTML 404
 *           from Vite itself, breaking JSON response parsing.
 * DEPENDS : vite, @vitejs/plugin-react
 * ============================================================
 * NOTE: This proxy is dev-only. In production a reverse proxy
 *       (nginx, etc.) handles /api routing. The Axios baseURL
 *       stays as '/api' in both environments — no .env swap needed.
 * ============================================================
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        /*
         * WHY changeOrigin: true:
         *   Rewrites the Host header of the proxied request to match
         *   the target (localhost:5000). Required when Express checks
         *   the Origin or Host header for CORS validation — without
         *   this the header still reads localhost:5173 and CORS can
         *   reject the request even though it came through the proxy.
         */
        changeOrigin: true,
      },
    },
  },
})
