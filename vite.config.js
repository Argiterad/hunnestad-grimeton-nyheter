import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

const pages = [
  'index',
  'artikel',
  'samhalle',
  'ekonomi',
  'sport',
  'kultur',
  'program',
  'om',
  'annonsera',
  'integritet',
];

export default defineConfig({
  base: './',
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((name) => [name, resolve(root, `${name}.html`)]),
      ),
    },
  },
  plugins: [
    {
      name: 'pages-nojekyll',
      closeBundle() {
        writeFileSync(join(resolve(root, 'dist'), '.nojekyll'), '');
      },
    },
  ],
});
