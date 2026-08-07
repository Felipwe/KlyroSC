import { badgeLabel } from '@shared/utils/badge'
import { api } from '@renderer/services/ipc'

let lastSent = -1

/** Draws the red iOS-style badge and pushes it to the taskbar icon (main process). */
export function updateAppBadge(count: number): void {
  const clamped = Math.max(0, Math.floor(count))
  if (clamped === lastSent) return
  lastSent = clamped
  if (clamped === 0) {
    api.window.setBadge(0, null)
    return
  }
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2)
  ctx.fillStyle = '#e5484d'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.stroke()
  const label = badgeLabel(clamped)
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${label.length > 1 ? 15 : 18}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, size / 2, size / 2 + 1)
  api.window.setBadge(clamped, canvas.toDataURL('image/png'))
}
