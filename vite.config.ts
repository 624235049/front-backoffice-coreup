import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// VITE_* vars live in this repo's `.env` (standalone project). Vite's own loadEnv/envDir would also pick up a
// NODE_ENV=development and turn production builds into dev builds, so only the VITE_ keys are read, by hand.
const rootEnv = () => {
  const file = path.resolve(import.meta.dirname, '.env');
  const parsed = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  const merged = { ...parsed, ...process.env };
  return Object.fromEntries(
    Object.entries(merged)
      .filter(([k, v]) => k.startsWith('VITE_') && v !== undefined)
      .map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
  );
};

export default defineConfig(() => ({
  define: rootEnv(),
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: { port: 15174, strictPort: true },
  preview: { port: 15174 },
  build: { sourcemap: true },
  plugins: [
    // Must come before react().
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon-32.png',
        'apple-touch-icon.png',
        'logo-wordmark.png',
        'logo-wordmark-light.png',
        'logo-full.png',
      ],
      manifest: {
        name: 'CoreUp Team',
        short_name: 'CoreUp Team',
        description: 'CoreUp Team — หลังบ้านทีม CoreUp',
        lang: 'th',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0B2D4F',
        background_color: '#F8F5ED',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell only. API responses hold personal data: never cached (docs/04 §8).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/v1\//, /^\/docs/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
}));
