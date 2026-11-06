import { defineConfig } from 'vite';

// One self-contained file: no external scripts, stylesheets or fonts, so it can ship
// inside the WordPress plugin and run on any website.
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: {
      entry: 'src/main.tsx',
      formats: ['iife'],
      name: 'NimbusPalWidget',
      fileName: () => 'nimbuspal-widget.js',
    },
    target: 'es2019',
    cssCodeSplit: false,
    emptyOutDir: true,
  },
});
