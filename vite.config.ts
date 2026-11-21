import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const viteGeminiKey = (process.env.VITE_GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '').trim();

  return {
    base: command === 'build' ? './' : '/',
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(viteGeminiKey),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom/client',
        'lucide-react',
        'motion/react',
        'firebase/app',
        'firebase/auth',
        'firebase/database',
        'firebase/analytics',
        '@capacitor/core',
        '@capacitor/local-notifications',
        '@capacitor/filesystem',
        '@capacitor/share',
        '@capacitor/browser',
        '@capacitor/device',
        '@onesignal/capacitor-plugin',
        'canvas-confetti',
        'jspdf',
        'capacitor-native-biometric',
        'd3',
        '@emailjs/browser',
      ],
      exclude: ['@google/genai'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/www/**', '**/dist/**']
      },
    },
  };
});
