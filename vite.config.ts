import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path matches the GitHub Pages project URL (bonzaijoe.github.io/EnthusiastToolboxRetracked)
export default defineConfig({
  plugins: [react()],
  base: '/EnthusiastToolboxRetracked/',
})
