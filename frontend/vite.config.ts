import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The dev server's own settings come from .env like the app's. Vite only puts them in process.env for
  // the app, not for this file, hence loadEnv ('' = every key, not just VITE_*).
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        src: path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      // Behind nginx the site is opened on its own host name (VITE_ALLOWED_HOSTS, comma-separated), and Vite
      // rejects requests for hosts it doesn't know. localhost is always allowed, so local dev needs none.
      allowedHosts: env.VITE_ALLOWED_HOSTS ? env.VITE_ALLOWED_HOSTS.split(',') : [],
      // Opened straight on the Vite port (no nginx in front), /api would hit Vite itself -- forward it to
      // the backend (VITE_API_PROXY_TARGET, e.g. http://127.0.0.1:3001). Behind nginx, nginx routes /api.
      proxy: env.VITE_API_PROXY_TARGET
        ? { '/api': { target: env.VITE_API_PROXY_TARGET, changeOrigin: true } }
        : undefined,
    },
  };
});
