import { cpSync, createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

function serveData(middlewares) {
  const dataDir = resolve(root, 'data');
  middlewares.use((req, res, next) => {
    const raw = (req.url || '').split('?')[0];
    if (!raw.startsWith('/data/')) return next();

    let rel = raw.slice('/data/'.length);
    try {
      rel = decodeURIComponent(rel);
    } catch {
      return next();
    }
    if (!rel || rel.includes('\0')) return next();

    const file = resolve(dataDir, rel);
    if (file !== dataDir && !file.startsWith(dataDir + sep)) return next();
    if (!existsSync(file) || !statSync(file).isFile()) return next();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    createReadStream(file).on('error', next).pipe(res);
  });
}

export default defineConfig({
  base: './',
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        om: resolve(root, 'om.html'),
      },
    },
  },
  plugins: [
    {
      name: 'news-data',
      configureServer(server) {
        serveData(server.middlewares);
      },
      configurePreviewServer(server) {
        serveData(server.middlewares);
      },
      closeBundle() {
        const dist = resolve(root, 'dist');
        cpSync(resolve(root, 'data'), join(dist, 'data'), { recursive: true });
        writeFileSync(join(dist, '.nojekyll'), '');
      },
    },
  ],
});
