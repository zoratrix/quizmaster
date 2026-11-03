import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');

const mainShared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'info',
  absWorkingDir: projectRoot
};

await rm(path.join(projectRoot, 'dist'), { recursive: true, force: true });

await build({
  ...mainShared,
  entryPoints: ['src/main/index.ts'],
  outfile: 'dist/main/index.js'
});

await build({
  ...mainShared,
  entryPoints: ['src/preload/index.ts'],
  outfile: 'dist/preload/index.js'
});

const { build: viteBuild } = await import('vite');
await viteBuild({ configFile: path.join(projectRoot, 'vite.config.ts') });

console.log('\nСборка готова: dist/main, dist/preload, dist/renderer');
