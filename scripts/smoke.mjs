import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

if (!existsSync(join(root, 'out', 'main', 'index.js'))) {
  console.error('Build output missing. Run "npm run build" first.')
  process.exit(1)
}

const electron =
  process.platform === 'win32'
    ? join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
    : join(root, 'node_modules', '.bin', 'electron')

const child = spawn(electron, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, KLYRO_SMOKE: '1' }
})

child.on('exit', (code) => {
  const smokeDir = join(root, 'out', 'smoke')
  if (existsSync(smokeDir)) {
    console.log('\nSmoke captures:')
    for (const file of readdirSync(smokeDir)) console.log('  out/smoke/' + file)
  }
  process.exit(code ?? 1)
})
