// vite.config.ts
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'useAutoSaveForm',
      // Output proper filenames for each format
      fileName: (format) =>
        format === 'es'
          ? 'useAutoSaveForm.mjs'
          : 'useAutoSaveForm.cjs',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      // Don't bundle Vue
      external: ['vue']
    }
  },
  plugins: [
    dts({
      outDir: 'dist',
      insertTypesEntry: true // so `types` in package.json works without extra config
    })
  ]
})
