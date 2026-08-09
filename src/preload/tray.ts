import { contextBridge, ipcRenderer } from 'electron'

// literal channels: sandboxed preloads must stay a single self-contained bundle
contextBridge.exposeInMainWorld('trayApi', {
  onState: (cb: (state: unknown) => void): void => {
    ipcRenderer.on('tray:state', (_event, state) => cb(state))
  },
  onClosing: (cb: () => void): void => {
    ipcRenderer.on('tray:closing', () => cb())
  },
  action: (name: string): void => {
    ipcRenderer.send('tray:action', name)
  }
})
