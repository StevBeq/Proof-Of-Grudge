import { existsSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2];
if (process.argv.length !== 3 || !['test', 'build'].includes(command)) {
  console.error('Use rust-toolchain.mjs test|build.');
  process.exit(1);
}
const env = { ...process.env };
// An optional official portable NASM installation avoids changing Windows' global PATH.
const portableNasm = resolve(root, '.rtk/tools/nasm-3.02');
if (process.platform === 'win32' && existsSync(resolve(portableNasm, 'nasm.exe'))) {
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') ?? 'Path';
  env[pathKey] = portableNasm + delimiter + (env[pathKey] ?? '');
}
const args = command === 'test'
  ? ['test', '--locked', '--manifest-path', 'contract/Cargo.toml', '--', '--nocapture']
  : ['near', 'build', 'non-reproducible-wasm', '--locked', '--manifest-path', 'contract/Cargo.toml',
    '--abi-features', 'near-sdk/unit-testing'];
const result = spawnSync('cargo', args, { cwd: root, env, stdio: 'inherit' });
if (result.error) console.error('Could not start Cargo. Check the installed Rust toolchain and host build prerequisites.');
process.exit(result.status ?? 1);
