import { build } from 'esbuild';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');
const require = createRequire(import.meta.url);
const electronPath = require('electron');

const esbuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  logLevel: 'warning',
  absWorkingDir: projectRoot
};

async function buildMainProcess() {
  await build({ ...esbuildOptions, entryPoints: ['src/main/index.ts'], outfile: 'dist/main/index.js' });
  await build({ ...esbuildOptions, entryPoints: ['src/preload/index.ts'], outfile: 'dist/preload/index.js' });
}

async function main() {
  await buildMainProcess();

  let child = null;
  let restarting = false;

  function startElectron(devUrl) {
    const args = ['.'];
    // в ограниченных окружениях (VM, удалённый рабочий стол) Chromium-песочницу нужно отключить
    if (process.env.QM_NO_SANDBOX === '1') args.push('--no-sandbox', '--disable-gpu');
    child = spawn(electronPath, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, QM_DEV_SERVER_URL: devUrl, QM_DEV: '1' }
    });
    child.on('error', (error) => {
      console.error('[dev] Не удалось запустить Electron:', error.message);
    });
    child.on('exit', (code, signal) => {
      console.log(`[dev] Electron завершился (код ${code}, сигнал ${signal})`);
      if (!restarting && code !== null) {
        void server.close().then(() => process.exit(code ?? 0));
      }
    });
  }

  const server = await createServer({ configFile: path.join(projectRoot, 'vite.config.ts') });
  await server.listen();
  const devUrl = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5273/';
  console.log(`\n  QuizMaster dev\n  renderer: ${devUrl}\n`);

  startElectron(devUrl);

  // main/preload собираются заново, Electron перезапускается — renderer обновляется сам (HMR)
  const watchedRoots = ['src/main', 'src/preload', 'src/shared'].map((dir) => path.join(projectRoot, dir));
  server.watcher.on('change', async (file) => {
    if (!file.endsWith('.ts')) return;
    if (!watchedRoots.some((dir) => file.startsWith(dir))) return;
    try {
      await buildMainProcess();
      restarting = true;
      child?.kill();
      await new Promise((resolve) => setTimeout(resolve, 300));
      startElectron(devUrl);
      restarting = false;
      console.log('[dev] Electron перезапущен');
    } catch (error) {
      console.error('[dev] Ошибка пересборки:', error instanceof Error ? error.message : error);
    }
  });

  process.on('SIGINT', async () => {
    child?.kill();
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[dev] Не удалось запустить режим разработки:', error);
  process.exit(1);
});
