// 打包 Sublime 套件與 VS Code vsix，並用同一份 .dat 比對兩邊解出來的文字。
// Packs the Sublime package and the VS Code vsix, then compares both decoders on the same .dat.

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const buildDir = join(root, 'build')
const sample = join(root, '../lf2_mod/bk/kate/data/template.dat')
const require = createRequire(join(root, 'vscode/package.json'))

mkdirSync(buildDir, { recursive: true })

const esbuild = require('esbuild')
await esbuild.build({
  absWorkingDir: join(root, 'vscode'),
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  sourcemap: true,
})

const tsc = spawnSync('npx', ['tsc', '--noEmit'], { cwd: join(root, 'vscode'), stdio: 'inherit' })
if (tsc.status !== 0) process.exit(tsc.status ?? 1)

if (existsSync(sample)) {
  const nodeOut = join(buildDir, 'node-decoded.txt')
  const pyOut = join(buildDir, 'py-decoded.txt')
  await esbuild.build({
    absWorkingDir: join(root, 'vscode'),
    entryPoints: ['src/decode.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: join(buildDir, 'decode.mjs'),
  })
  const { decodeLf2Dat } = await import(join(buildDir, 'decode.mjs'))
  const text = decodeLf2Dat(readFileSync(sample))
  if (typeof text != 'string' || !text.includes('<bmp_begin>')) {
    console.error('node decoder did not recognise the sample')
    process.exit(1)
  }
  const { writeFileSync } = await import('node:fs')
  writeFileSync(nodeOut, text)
  const py = spawnSync('python3', [join(root, 'sublime/lf2_dat.py'), sample], { encoding: 'buffer' })
  if (py.status !== 0) {
    console.error(py.stderr?.toString() || 'python decoder failed')
    process.exit(py.status ?? 1)
  }
  writeFileSync(pyOut, py.stdout)
  // 檔尾若被截斷，Node 的 Big5 與 Python 的 Big5 可能多一個或少一個替代字元。其餘必須相同。
  // A truncated byte at the end of the file can make Node's Big5 and Python's Big5 differ by one replacement character. The rest must match.
  const norm = (value) => value.toString('utf8').replace(/\uFFFD+$/u, '')
  if (norm(readFileSync(nodeOut)) !== norm(py.stdout)) {
    console.error('node and python decoders disagree')
    process.exit(1)
  }
  rmSync(nodeOut)
  rmSync(pyOut)
  rmSync(join(buildDir, 'decode.mjs'))
  console.log('decoders match', sample)
} else {
  const py = spawnSync('python3', [join(root, 'sublime/lf2_dat.py')], { stdio: 'inherit' })
  if (py.status !== 0) process.exit(py.status ?? 1)
  console.log('sample .dat not found, skipped the compare')
}

const sublimePkg = join(buildDir, 'LF2-Data.sublime-package')
rmSync(sublimePkg, { force: true })
const zip = spawnSync('zip', ['-r', '-X', sublimePkg, '.', '-x', '__pycache__/*', '*.pyc'], {
  cwd: join(root, 'sublime'),
  stdio: 'inherit',
})
if (zip.status !== 0) process.exit(zip.status ?? 1)

const vsix = join(buildDir, 'lf2-data-0.1.0.vsix')
rmSync(vsix, { force: true })
const vsce = spawnSync(
  'npx',
  ['vsce', 'package', '--allow-missing-repository', '--skip-license', '-o', vsix],
  { cwd: join(root, 'vscode'), stdio: 'inherit' },
)
if (vsce.status !== 0) process.exit(vsce.status ?? 1)
console.log('built', sublimePkg)
console.log('built', vsix)
