import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: false,
  },
  server: {
    fs: {
      allow: [
        // Allow serving files from the workspace root (for contract artifacts via symlink)
        path.resolve(__dirname, '..'),
      ],
    },
  },
});
