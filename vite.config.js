import { defineConfig } from 'vite';
// Relative assets work on both user Pages and /repository/ project Pages.
export default defineConfig({ base: './', server: { host: '127.0.0.1', port: 3000, strictPort: true } });
