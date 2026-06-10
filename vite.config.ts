import preact from '@preact/preset-vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { execSync } from 'node:child_process'
import { createReadStream, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const commitHash = execSync('git rev-parse --short HEAD').toString().trim()

// Serve + bundle the ZXing-C++ reader wasm at a stable URL (/zxing_reader.wasm), resolved from the
// installed zxing-wasm package so it's version-locked and self-hosted (no jsDelivr CDN). Workbox
// precaches it (globPatterns includes *.wasm) so barcode scanning works offline. This sidesteps
// the `?url` + package-exports-map resolution failure under Rollup.
function zxingWasm(): Plugin {
  // zxing-wasm is barcode-detector's dependency and pnpm does not hoist it to the top-level
  // node_modules, so resolve it from barcode-detector's context (not the project root). This is
  // hoist-independent and guarantees the wasm matches the glue code barcode-detector loads.
  const fromHere = createRequire(import.meta.url)
  const wasmPath = createRequire(fromHere.resolve('barcode-detector')).resolve('zxing-wasm/reader/zxing_reader.wasm')
  return {
    name: 'zxing-wasm-asset',
    configureServer(server) {
      server.middlewares.use('/zxing_reader.wasm', (_req, res) => {
        res.setHeader('Content-Type', 'application/wasm')
        createReadStream(wasmPath).pipe(res)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'zxing_reader.wasm', source: readFileSync(wasmPath) })
    },
  }
}

export default defineConfig({
  base: '/',
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  server: {
    host: true,
    port: 5173,
  },
  plugins: [
    basicSsl(),
    preact(),
    zxingWasm(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Calorie Counter',
        short_name: 'Calories',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#10b981',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wasm}'],
        // The ZXing reader wasm is ~1 MB; raise the precache size cap so it's bundled for offline use.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'off-api-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
