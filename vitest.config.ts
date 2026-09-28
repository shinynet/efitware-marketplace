import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Compiles single-file components so contract tests can server-render the card's views.
export default defineConfig({ plugins: [vue()] })
