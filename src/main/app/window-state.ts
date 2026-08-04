import { screen, type BrowserWindow, type Rectangle } from 'electron'
import { isRecord } from '@shared/types/result'
import { JsonStore } from '../core/store'
import { paths } from '../core/paths'

interface WindowState {
  width: number
  height: number
  x: number | null
  y: number | null
  maximized: boolean
}

const DEFAULTS: WindowState = { width: 1360, height: 800, x: null, y: null, maximized: false }

const parseState = (raw: unknown): WindowState => {
  if (!isRecord(raw)) return { ...DEFAULTS }
  return {
    width: typeof raw.width === 'number' ? Math.max(980, raw.width) : DEFAULTS.width,
    height: typeof raw.height === 'number' ? Math.max(640, raw.height) : DEFAULTS.height,
    x: typeof raw.x === 'number' ? raw.x : null,
    y: typeof raw.y === 'number' ? raw.y : null,
    maximized: raw.maximized === true
  }
}

export class WindowStateKeeper {
  private store = new JsonStore<WindowState>(paths.windowStateFile(), parseState)

  get(): WindowState {
    const state = this.store.get()
    if (state.x === null || state.y === null) return state
    const bounds: Rectangle = { x: state.x, y: state.y, width: state.width, height: state.height }
    const visible = screen.getAllDisplays().some((display) => {
      const area = display.workArea
      return (
        bounds.x + bounds.width > area.x + 40 &&
        bounds.x < area.x + area.width - 40 &&
        bounds.y >= area.y - 20 &&
        bounds.y < area.y + area.height - 40
      )
    })
    return visible ? state : { ...state, x: null, y: null }
  }

  track(window: BrowserWindow): void {
    const save = (): void => {
      if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return
      const maximized = window.isMaximized()
      const bounds = maximized ? window.getNormalBounds() : window.getBounds()
      this.store.set({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        maximized
      })
    }
    window.on('resized', save)
    window.on('moved', save)
    window.on('maximize', save)
    window.on('unmaximize', save)
    window.on('close', () => {
      save()
      this.store.flush()
    })
  }
}
