import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const build = join(root, 'build')

const payload = readdirSync(dist).find((f) => /^KlyroSC-Update-.*\.exe$/.test(f))
if (!payload) {
  console.error('Update payload not found in dist/. Run electron-builder first.')
  process.exit(1)
}
const version = /KlyroSC-Update-(.+)\.exe/.exec(payload)[1]

const bgPng = join(build, 'bootstrap-bg.png')
if (!existsSync(bgPng)) {
  const electron = join(
    root,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron'
  )
  const art = spawnSync(electron, [join(root, 'scripts', 'make-installer-art.cjs'), root], {
    stdio: 'inherit'
  })
  if (art.status !== 0) process.exit(art.status ?? 1)
}

const csc = ['Framework64', 'Framework']
  .map((arch) => join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', arch, 'v4.0.30319', 'csc.exe'))
  .find(existsSync)
if (!csc) {
  console.error('csc.exe (.NET Framework 4) not found.')
  process.exit(1)
}

const out = join(dist, `KlyroSC-Setup-${version}.exe`)
execFileSync(
  csc,
  [
    '/nologo',
    '/target:winexe',
    '/platform:anycpu',
    '/optimize+',
    `/win32icon:${join(build, 'icon.ico')}`,
    `/win32manifest:${join(root, 'installer-src', 'app.manifest')}`,
    `/resource:${join(dist, payload)},payload.exe`,
    `/resource:${bgPng},bg.png`,
    `/out:${out}`,
    join(root, 'installer-src', 'Bootstrapper.cs')
  ],
  { stdio: 'inherit' }
)

const mb = (statSync(out).size / 1024 / 1024).toFixed(1)
console.log(`themed installer built: dist/KlyroSC-Setup-${version}.exe (${mb} MB)`)
