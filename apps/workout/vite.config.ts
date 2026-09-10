import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import postcss from 'postcss'

// Reuse the product's actual theme declarations without importing its application CSS.
const theme = postcss.parse(readFileSync(new URL('./theme/product.css', import.meta.url), 'utf8'))
const tokens = postcss.root()
const fontLicenses = ['inter', 'newsreader', 'ibm-plex-sans', 'dm-sans', 'lora']
  .map(name => readFileSync(new URL(`./theme/fonts/${name}-OFL.txt`, import.meta.url), 'utf8'))
  .join('\n\n')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
theme.walkRules((rule) => {
  if (!/^(:root|html\.)/.test(rule.selector)) return
  const copy = rule.clone({ nodes: [] })
  rule.walkDecls(/^--/, (declaration) => {
    copy.append(declaration.clone())
  })
  if (copy.nodes.length) tokens.append(copy)
})
theme.walkAtRules('theme', (rule) => {
  const copy = postcss.atRule({ name: 'theme', params: 'static' })
  rule.walkDecls(/^--/, (declaration) => {
    copy.append(declaration.clone())
  })
  tokens.prepend(copy)
})

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  plugins: [
    { name: 'efitware-theme', enforce: 'pre', transform: (code, id) => id.endsWith('/apps/workout/styles.css') ? code.replace('/* PRODUCT_THEME */', tokens.toString()) : undefined },
    { name: 'efitware-font-licenses', transformIndexHtml: html => html.replace('</body>', `<template id="font-licenses">${fontLicenses}</template></body>`) },
    vue(), tailwindcss(), viteSingleFile()
  ],
  define: { __VUE_OPTIONS_API__: false, __VUE_PROD_DEVTOOLS__: false },
  build: {
    outDir: '../../dist/card', emptyOutDir: true,
    assetsInlineLimit: 1_000_000,
    rollupOptions: { input: fileURLToPath(new URL('./workout.html', import.meta.url)) }
  }
})
