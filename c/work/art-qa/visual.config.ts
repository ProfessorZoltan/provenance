import {defineConfig} from 'vite';
export default defineConfig({base:'./', build:{rollupOptions:{input:'work/visual.html'},outDir:'../../work/visual-dist'}});
