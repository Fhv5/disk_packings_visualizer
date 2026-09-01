import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const outputDirectory = path.join('.next', 'export-data');
const compile = spawnSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'scripts/export-data.ts',
  '--outDir', outputDirectory,
  '--rootDir', '.',
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--target', 'ES2022',
  '--esModuleInterop',
  '--skipLibCheck',
  '--noEmit', 'false',
], { stdio: 'inherit' });

if (compile.status !== 0) process.exit(compile.status ?? 1);

const workerPath = path.join(outputDirectory, 'scripts', 'export-data.js');
const run = spawnSync(process.execPath, [workerPath, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(run.status ?? 1);
