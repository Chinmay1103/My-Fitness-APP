import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The built site goes to docs/web, which GitHub Pages already serves (next to the coach
// connector's consent page): https://chinmay1103.github.io/My-Fitness-APP/web/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../../docs/web', emptyOutDir: true },
});
