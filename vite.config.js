import { defineConfig, createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };
const MARK = '<!--island:build-->';

// Глава «Из чего сделан» (src/build/) собирается на React + shadcn, но в браузер уходит готовым HTML:
// плагин рендерит её в index.html на место метки. В dev — через текущий сервер, при сборке — через временный.
function staticIsland() {
  let dev;
  // язык главы — из <html lang> страницы: index.html (ru) или en/index.html (en)
  const load = async (server, lang) => (await server.ssrLoadModule('/src/build/render.jsx')).renderBuild(lang);
  return {
    name: 'static-island',
    configureServer(server) { dev = server; },
    // правка главы в dev: страница перезагружается с новой разметкой
    handleHotUpdate({ file, server }) {
      if (file.includes('/src/build/')) server.ws.send({ type: 'full-reload' });
    },
    async transformIndexHtml(html) {
      if (!html.includes(MARK)) return html;
      const lang = /<html[^>]*\blang="en"/.test(html) ? 'en' : 'ru';
      let markup;
      if (dev) markup = await load(dev, lang);
      else {
        const tmp = await createServer({
          configFile: false, plugins: [react()], resolve: { alias },
          server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent',
        });
        try { markup = await load(tmp, lang); } finally { await tmp.close(); }
      }
      return html.replace(MARK, markup);
    },
  };
}

// three.js подгружается отдельным чанком (import() в main.js), поэтому лимит выше дефолтного.
export default defineConfig({
  plugins: [react(), tailwindcss(), staticIsland()],
  resolve: { alias },
  server: { port: 5190 },
  // публичный туннель для проверки с телефона вне домашней сети: cloudflared или ssh -p 443 -R0:localhost:4173 a.pinggy.io
  preview: { port: 4173, allowedHosts: ['.trycloudflare.com', '.pinggy.net', '.pinggy-free.link', '.pinggy.link'] },
  // две страницы: русская в корне, английская в /en/
  build: { chunkSizeWarningLimit: 700, rollupOptions: { input: { main: 'index.html', en: 'en/index.html' } } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
});
