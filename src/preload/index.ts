import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type KlyroApi, type NavPayload, type Unsubscribe } from '@shared/types/ipc'
import { type Settings } from '@shared/types/settings'
import { type MediaAction } from '@shared/types/player'
import { type UpdateStatus } from '@shared/types/update'
import { type AuthState } from '@shared/types/auth'
import { type PluginInfo } from '@shared/types/plugin'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>

const send = (channel: string, ...args: unknown[]): void => {
  ipcRenderer.send(channel, ...args)
}

const listen = <T>(channel: string, cb: (payload: T) => void): Unsubscribe => {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: KlyroApi = {
  platform: process.platform,
  window: {
    minimize: () => send(IPC.windowMinimize),
    maximizeToggle: () => send(IPC.windowMaximizeToggle),
    close: () => send(IPC.windowClose),
    isMaximized: () => invoke(IPC.windowIsMaximized),
    setMiniMode: (on) => invoke(IPC.windowSetMini, on),
    onMaximized: (cb) => listen<boolean>(IPC.windowMaximized, cb)
  },
  app: {
    info: () => invoke(IPC.appInfo),
    quit: () => send(IPC.appQuit),
    relaunch: () => send(IPC.appRelaunch),
    openExternal: (url) => send(IPC.shellOpenExternal, url),
    openPath: (kind) => send(IPC.appOpenPath, kind)
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    set: (patch) => invoke(IPC.settingsSet, patch),
    reset: () => invoke(IPC.settingsReset),
    onChange: (cb) => listen<Settings>(IPC.settingsChanged, cb)
  },
  auth: {
    status: () => invoke(IPC.authStatus),
    login: () => invoke(IPC.authLogin),
    logout: () => invoke(IPC.authLogout),
    onChange: (cb) => listen<AuthState>(IPC.authChanged, cb)
  },
  sc: {
    home: () => invoke(IPC.scHome),
    charts: (genre) => invoke(IPC.scCharts, { genre }),
    countryCharts: (country) => invoke(IPC.scCountryCharts, { country }),
    search: (kind, query, nextHref) => invoke(IPC.scSearch, { kind, query, nextHref }),
    track: (id) => invoke(IPC.scTrack, id),
    tracks: (ids) => invoke(IPC.scTracks, ids),
    playlist: (ref) => invoke(IPC.scPlaylist, ref),
    user: (id) => invoke(IPC.scUser, id),
    userTracks: (id, nextHref) => invoke(IPC.scUserTracks, { id, nextHref }),
    userReposts: (id) => invoke(IPC.scUserReposts, id),
    related: (id) => invoke(IPC.scRelated, id),
    comments: (id, nextHref) => invoke(IPC.scComments, { id, nextHref }),
    addComment: (id, body, timestampMs) => invoke(IPC.scCommentAdd, { id, body, timestampMs }),
    setRepost: (id, on) => invoke(IPC.scRepostSet, { id, on }),
    resolve: (url) => invoke(IPC.scResolve, url),
    stream: (trackId, fresh) => invoke(IPC.scStream, { id: trackId, fresh: fresh === true })
  },
  library: {
    get: () => invoke(IPC.libraryGet),
    toggleFavorite: (track) => invoke(IPC.libraryToggleFavorite, track),
    createPlaylist: (name) => invoke(IPC.libraryCreatePlaylist, name),
    renamePlaylist: (id, name) => invoke(IPC.libraryRenamePlaylist, { id, name }),
    deletePlaylist: (id) => invoke(IPC.libraryDeletePlaylist, id),
    setPlaylistCover: (id) => invoke(IPC.librarySetCover, id),
    removePlaylistCover: (id) => invoke(IPC.libraryRemoveCover, id),
    addToPlaylist: (id, tracks) => invoke(IPC.libraryAddToPlaylist, { id, tracks }),
    removeFromPlaylist: (id, index) => invoke(IPC.libraryRemoveFromPlaylist, { id, index }),
    moveInPlaylist: (id, from, to) => invoke(IPC.libraryMoveInPlaylist, { id, from, to }),
    movePlaylist: (from, to) => invoke(IPC.libraryMovePlaylist, { from, to }),
    addHistory: (track) => invoke(IPC.libraryAddHistory, track),
    clearHistory: () => invoke(IPC.libraryClearHistory),
    exportData: () => invoke(IPC.libraryExport),
    importData: () => invoke(IPC.libraryImport)
  },
  playback: {
    load: () => invoke(IPC.playbackLoad),
    save: (snapshot) => send(IPC.playbackSave, snapshot)
  },
  eq: {
    exportPreset: (preset) => invoke(IPC.eqExport, preset),
    importPreset: () => invoke(IPC.eqImport)
  },
  presence: {
    update: (payload) => send(IPC.presenceUpdate, payload)
  },
  lyrics: {
    get: (artist, title, duration) => invoke(IPC.lyricsGet, { artist, title, duration })
  },
  plugins: {
    list: () => invoke(IPC.pluginsList),
    setEnabled: (id, enabled) => invoke(IPC.pluginsSetEnabled, { id, enabled }),
    configure: (id, config) => invoke(IPC.pluginsConfigure, { id, config }),
    reload: () => invoke(IPC.pluginsReload),
    install: () => invoke(IPC.pluginsInstall),
    uninstall: (id) => invoke(IPC.pluginsUninstall, id),
    emitPlayerEvent: (event) => send(IPC.pluginsPlayerEvent, event)
  },
  updates: {
    status: () => invoke(IPC.updatesStatus),
    check: () => invoke(IPC.updatesCheck),
    download: () => invoke(IPC.updatesDownload),
    install: () => send(IPC.updatesInstall),
    onStatus: (cb) => listen<UpdateStatus>(IPC.updateStatusEvent, cb)
  },
  downloads: {
    track: (trackId, title) => invoke(IPC.downloadsTrack, trackId, title),
    openFolder: () => send(IPC.downloadsOpenFolder)
  },
  events: {
    onMedia: (cb) => listen<MediaAction>(IPC.media, cb),
    onPlayerCommand: (cb) => listen<MediaAction>(IPC.playerCommand, cb),
    onPluginToast: (cb) => listen<string>(IPC.pluginToast, cb),
    onPluginsChanged: (cb) => listen<PluginInfo[]>(IPC.pluginsChanged, cb),
    onNav: (cb) => listen<NavPayload>(IPC.nav, cb)
  },
  log: (level, message) => send(IPC.logRenderer, { level, message })
}

contextBridge.exposeInMainWorld('klyro', api)
