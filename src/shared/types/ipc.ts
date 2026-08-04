import { type Result, type DeepPartial } from './result'
import { type Settings } from './settings'
import {
  type Artist,
  type HomeSection,
  type Page,
  type PlaylistLite,
  type RemotePlaylist,
  type ResolvedItem,
  type SearchKind,
  type Track
} from './track'
import {
  type Lyrics,
  type MediaAction,
  type PlaybackSnapshot,
  type PlayerEvent,
  type PresencePayload,
  type StreamSource
} from './player'
import { type LibraryData } from './library'
import { type PluginConfigValue, type PluginInfo } from './plugin'
import { type UpdateStatus } from './update'
import { type AuthState } from './auth'

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  electron: string
  chrome: string
  arch: string
}

export type OpenPathKind = 'userData' | 'logs' | 'downloads' | 'plugins'

export type NavPayload = { name: string; params?: Record<string, string> }

export type Unsubscribe = () => void

export interface KlyroApi {
  platform: NodeJS.Platform
  window: {
    minimize(): void
    maximizeToggle(): void
    close(): void
    isMaximized(): Promise<boolean>
    setMiniMode(on: boolean): Promise<void>
    onMaximized(cb: (maximized: boolean) => void): Unsubscribe
  }
  app: {
    info(): Promise<AppInfo>
    quit(): void
    relaunch(): void
    openExternal(url: string): void
    openPath(kind: OpenPathKind): void
  }
  settings: {
    get(): Promise<Settings>
    set(patch: DeepPartial<Settings>): Promise<Settings>
    reset(): Promise<Settings>
    onChange(cb: (settings: Settings) => void): Unsubscribe
  }
  auth: {
    status(): Promise<AuthState>
    login(): Promise<Result<AuthState>>
    logout(): Promise<AuthState>
    onChange(cb: (state: AuthState) => void): Unsubscribe
  }
  sc: {
    home(): Promise<Result<HomeSection[]>>
    charts(genre: string): Promise<Result<Track[]>>
    search(kind: SearchKind, query: string, nextHref?: string | null): Promise<Result<Page<Track | Artist | PlaylistLite>>>
    track(id: number): Promise<Result<Track>>
    tracks(ids: number[]): Promise<Result<Track[]>>
    playlist(ref: string): Promise<Result<RemotePlaylist>>
    user(id: number): Promise<Result<Artist>>
    userTracks(id: number, nextHref?: string | null): Promise<Result<Page<Track>>>
    related(id: number): Promise<Result<Track[]>>
    resolve(url: string): Promise<Result<ResolvedItem>>
    stream(trackId: number): Promise<Result<StreamSource>>
  }
  library: {
    get(): Promise<LibraryData>
    toggleFavorite(track: Track): Promise<LibraryData>
    createPlaylist(name: string): Promise<LibraryData>
    renamePlaylist(id: string, name: string): Promise<LibraryData>
    deletePlaylist(id: string): Promise<LibraryData>
    setPlaylistCover(id: string): Promise<Result<LibraryData | null>>
    removePlaylistCover(id: string): Promise<LibraryData>
    addToPlaylist(id: string, tracks: Track[]): Promise<LibraryData>
    removeFromPlaylist(id: string, index: number): Promise<LibraryData>
    moveInPlaylist(id: string, from: number, to: number): Promise<LibraryData>
    addHistory(track: Track): Promise<LibraryData>
    clearHistory(): Promise<LibraryData>
    exportData(): Promise<Result<string | null>>
    importData(): Promise<Result<LibraryData | null>>
  }
  playback: {
    load(): Promise<PlaybackSnapshot | null>
    save(snapshot: PlaybackSnapshot): void
  }
  presence: {
    update(payload: PresencePayload | null): void
  }
  lyrics: {
    get(artist: string, title: string, duration: number): Promise<Result<Lyrics>>
  }
  plugins: {
    list(): Promise<PluginInfo[]>
    setEnabled(id: string, enabled: boolean): Promise<PluginInfo[]>
    configure(id: string, config: Record<string, PluginConfigValue>): Promise<PluginInfo[]>
    reload(): Promise<PluginInfo[]>
    install(): Promise<Result<PluginInfo[] | null>>
    uninstall(id: string): Promise<Result<PluginInfo[]>>
    emitPlayerEvent(event: PlayerEvent): void
  }
  updates: {
    status(): Promise<UpdateStatus>
    check(): Promise<UpdateStatus>
    download(): Promise<UpdateStatus>
    install(): void
    onStatus(cb: (status: UpdateStatus) => void): Unsubscribe
  }
  downloads: {
    track(trackId: number, title: string): Promise<Result<string>>
    openFolder(): void
  }
  events: {
    onMedia(cb: (action: MediaAction) => void): Unsubscribe
    onPlayerCommand(cb: (action: MediaAction) => void): Unsubscribe
    onPluginToast(cb: (message: string) => void): Unsubscribe
    onNav(cb: (payload: NavPayload) => void): Unsubscribe
  }
  log(level: 'info' | 'warn' | 'error', message: string): void
}

export const IPC = {
  windowMinimize: 'window:minimize',
  windowMaximizeToggle: 'window:maximize-toggle',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  windowSetMini: 'window:set-mini',
  windowMaximized: 'window:maximized',
  appInfo: 'app:info',
  appQuit: 'app:quit',
  appRelaunch: 'app:relaunch',
  appOpenPath: 'app:open-path',
  shellOpenExternal: 'shell:open-external',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsReset: 'settings:reset',
  settingsChanged: 'settings:changed',
  authStatus: 'auth:status',
  authLogin: 'auth:login',
  authLogout: 'auth:logout',
  authChanged: 'auth:changed',
  scHome: 'sc:home',
  scCharts: 'sc:charts',
  scSearch: 'sc:search',
  scTrack: 'sc:track',
  scTracks: 'sc:tracks',
  scPlaylist: 'sc:playlist',
  scUser: 'sc:user',
  scUserTracks: 'sc:user-tracks',
  scRelated: 'sc:related',
  scResolve: 'sc:resolve',
  scStream: 'sc:stream',
  libraryGet: 'library:get',
  libraryToggleFavorite: 'library:toggle-favorite',
  libraryCreatePlaylist: 'library:create-playlist',
  libraryRenamePlaylist: 'library:rename-playlist',
  libraryDeletePlaylist: 'library:delete-playlist',
  librarySetCover: 'library:set-cover',
  libraryRemoveCover: 'library:remove-cover',
  libraryAddToPlaylist: 'library:add-to-playlist',
  libraryRemoveFromPlaylist: 'library:remove-from-playlist',
  libraryMoveInPlaylist: 'library:move-in-playlist',
  libraryAddHistory: 'library:add-history',
  libraryClearHistory: 'library:clear-history',
  libraryExport: 'library:export',
  libraryImport: 'library:import',
  playbackLoad: 'playback:load',
  playbackSave: 'playback:save',
  presenceUpdate: 'presence:update',
  lyricsGet: 'lyrics:get',
  pluginsList: 'plugins:list',
  pluginsSetEnabled: 'plugins:set-enabled',
  pluginsConfigure: 'plugins:configure',
  pluginsReload: 'plugins:reload',
  pluginsInstall: 'plugins:install',
  pluginsUninstall: 'plugins:uninstall',
  pluginsPlayerEvent: 'plugins:player-event',
  pluginToast: 'plugin:toast',
  playerCommand: 'player:command',
  updatesStatus: 'updates:status',
  updatesCheck: 'updates:check',
  updatesDownload: 'updates:download',
  updatesInstall: 'updates:install',
  updateStatusEvent: 'update:status',
  downloadsTrack: 'downloads:track',
  downloadsOpenFolder: 'downloads:open-folder',
  media: 'media',
  nav: 'nav',
  logRenderer: 'log:renderer'
} as const
