const { app, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')

const root = process.argv[2]
const srcPng = path.join(root, 'assets', 'icon-source.png')

function dibEntry(image, size) {
  const resized = image.resize({ width: size, height: size, quality: 'best' })
  const bgra = resized.toBitmap()
  const stride = size * 4
  const xor = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    bgra.copy(xor, (size - 1 - y) * stride, y * stride, y * stride + stride)
  }
  const maskStride = Math.ceil(size / 32) * 4
  const mask = Buffer.alloc(maskStride * size)
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16)
  header.writeUInt32LE(xor.length + mask.length, 20)
  return Buffer.concat([header, xor, mask])
}

app.whenReady().then(() => {
  const source = nativeImage.createFromPath(srcPng)
  if (source.isEmpty()) {
    console.error('could not read', srcPng)
    app.exit(1)
    return
  }
  const sizes = [16, 24, 32, 48, 64, 128]
  const blobs = sizes.map((size) => dibEntry(source, size))
  const png256 = source.resize({ width: 256, height: 256, quality: 'best' }).toPNG()
  blobs.push(png256)
  const all = [...sizes, 256]

  const headerSize = 6 + all.length * 16
  let offset = headerSize
  const dir = Buffer.alloc(headerSize)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(all.length, 4)
  all.forEach((size, i) => {
    const entry = 6 + i * 16
    dir.writeUInt8(size === 256 ? 0 : size, entry)
    dir.writeUInt8(size === 256 ? 0 : size, entry + 1)
    dir.writeUInt8(0, entry + 2)
    dir.writeUInt8(0, entry + 3)
    dir.writeUInt16LE(1, entry + 4)
    dir.writeUInt16LE(32, entry + 6)
    dir.writeUInt32LE(blobs[i].length, entry + 8)
    dir.writeUInt32LE(offset, entry + 12)
    offset += blobs[i].length
  })
  const ico = Buffer.concat([dir, ...blobs])

  fs.writeFileSync(path.join(root, 'assets', 'icon.ico'), ico)
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico)
  fs.writeFileSync(path.join(root, 'assets', 'icon.png'), source.toPNG())
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), png256)
  fs.writeFileSync(path.join(root, 'resources', 'icon.png'), png256)
  fs.writeFileSync(path.join(root, 'src', 'renderer', 'src', 'assets', 'icon.png'), png256)
  console.log('ico layers:', all.join(','), '| total', ico.length, 'bytes')
  app.exit(0)
})
