import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' makes assets load from any GitHub Pages repo subpath
export default defineConfig({ base: './', plugins: [react()] });
