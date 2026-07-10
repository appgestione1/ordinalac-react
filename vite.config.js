import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'node:fs'

// ID univoco per ogni build: l'app lo confronta con /version.json per
// auto-ricaricarsi quando c'è un deploy nuovo (vedi main.jsx)
const buildId = Date.now().toString(36)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'write-version-json',
      apply: 'build',
      writeBundle() {
        mkdirSync('dist', { recursive: true })
        writeFileSync('dist/version.json', JSON.stringify({ build: buildId }))
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
})
