import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the build work from any folder or sub-path of a static host.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], r3f: ['@react-three/fiber'], audio: ['howler'] },
      },
    },
  },
});
