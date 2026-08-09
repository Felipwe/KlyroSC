import { type Result, type DeepPartial } from './result'
import { type CustomTheme, type Settings } from './settings'
import {
  type Artist,
  type HomeSection,
  type Page,
  type PlaylistLite,
  type RemotePlaylist,
  type ResolvedItem,
  type SearchKind,
  type Track,
  type TrackComment
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
import {
  type AdminUsers,
  type ChatEventPayload,
  type ChatMessage,
  type JamPlayback,
  type JamTrackRef,
  type NewSocialAccount,
  type PresenceStatus,
  type SocialSnapshot,
  type UserStats
} from './social'

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  electron: string
  chrome: string
  arch: string
  country: string
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
    setIcon(dataUrl: string): void
    /** taskbar notification badge; overlay is a small PNG drawn by the renderer */
    setBadge(count: number, overlay: string | null): void
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
    countryCharts(country: string): Promise<Result<Track[]>>
    search(kind: SearchKind, query: string, nextHref?: string | null): Promise<Result<Page<Track | Artist | PlaylistLite>>>
    track(id: number): Promise<Result<Track>>
    tracks(ids: number[]): Promise<Result<Track[]>>
    playlist(ref: string): Promise<Result<RemotePlaylist>>
    user(id: number): Promise<Result<Artist>>
    userTracks(id: number, nextHref?: string | null): Promise<Result<Page<Track>>>
    userReposts(id: number): Promise<Result<Track[]>>
    related(id: number): Promise<Result<Track[]>>
    comments(id: number, nextHref?: string | null): Promise<Result<Page<TrackComment>>>
    addComment(id: number, body: string, timestampMs: number | null): Promise<Result<TrackComment | null>>
    setRepost(id: number, on: boolean): Promise<Result<void>>
    resolve(url: string): Promise<Result<ResolvedItem>>
    stream(trackId: number, fresh?: boolean): Promise<Result<StreamSource>>
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
    movePlaylist(from: number, to: number): Promise<LibraryData>
    setPlaylistPinned(id: string, pinned: boolean): Promise<LibraryData>
    addHistory(track: Track): Promise<LibraryData>
    clearHistory(): Promise<LibraryData>
    exportData(): Promise<Result<string | null>>
    importData(): Promise<Result<LibraryData | null>>
  }
  playback: {
    load(): Promise<PlaybackSnapshot | null>
    save(snapshot: PlaybackSnapshot): void
  }
  eq: {
    exportPreset(preset: { name: string; preamp: number; gains: number[] }): Promise<Result<string | null>>
    importPreset(): Promise<Result<{ name: string } | null>>
  }
  theme: {
    pickBackground(): Promise<Result<boolean | null>>
    exportTheme(payload: { name: string; theme: CustomTheme }): Promise<Result<string | null>>
    importTheme(): Promise<Result<{ name: string } | null>>
    /** live colors extracted from the playing cover (art theme) — mirrored by the tray popup */
    setAccentColors(colors: { a: string; b: string } | null): void
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
  social: {
    status(): Promise<SocialSnapshot>
    createAccount(): Promise<Result<NewSocialAccount>>
    confirmAccount(accountNumber: string): Promise<Result<SocialSnapshot>>
    login(accountNumber: string): Promise<Result<SocialSnapshot>>
    logout(): Promise<SocialSnapshot>
    deleteAccount(): Promise<Result<SocialSnapshot>>
    addFriend(publicId: number): Promise<Result<void>>
    respondRequest(id: string, accept: boolean): Promise<Result<void>>
    removeFriend(userId: string): Promise<Result<void>>
    createJam(): Promise<Result<void>>
    inviteToJam(userId: string): Promise<Result<void>>
    respondInvite(id: string, accept: boolean): Promise<Result<void>>
    leaveJam(): Promise<Result<void>>
    endJam(): Promise<Result<void>>
    setJamControl(allow: boolean): Promise<Result<void>>
    kickFromJam(userId: string): Promise<Result<void>>
    transferJam(userId: string): Promise<Result<void>>
    setStatus(status: PresenceStatus): void
    chatRead(friendId: string, upTo: number): void
    myStats(): Promise<UserStats>
    adminUsers(): Promise<Result<AdminUsers>>
    adminForceUpdate(): Promise<Result<void>>
    onAdminEvent(cb: (action: string) => void): Unsubscribe
    accountNumber(): Promise<string | null>
    reconnect(): void
    sendJamPlayback(payload: { track: JamTrackRef | null; playing: boolean; position: number }): void
    sendJamQueue(queue: JamTrackRef[]): void
    chatHistory(friendId: string, before?: number): Promise<Result<ChatMessage[]>>
    chatSend(friendId: string, text: string, tempId: string): Promise<Result<void>>
    chatTyping(friendId: string): void
    sendJamChat(text: string): void
    setAvatar(): Promise<Result<boolean | null>>
    removeAvatar(): Promise<Result<void>>
    rename(name: string): Promise<Result<void>>
    onState(cb: (snapshot: SocialSnapshot) => void): Unsubscribe
    onJamPlayback(cb: (playback: JamPlayback) => void): Unsubscribe
    onChatMessage(cb: (payload: ChatEventPayload) => void): Unsubscribe
    onChatSent(cb: (payload: { friendId: string; tempId: string; id: number; at: number }) => void): Unsubscribe
    onChatTyping(cb: (payload: { friendId: string }) => void): Unsubscribe
    onChatRejected(cb: (payload: { friendId?: string; tempId?: string; code: string }) => void): Unsubscribe
  }
  events: {
    onMedia(cb: (action: MediaAction) => void): Unsubscribe
    onPlayerCommand(cb: (action: MediaAction) => void): Unsubscribe
    onPluginToast(cb: (message: string) => void): Unsubscribe
    onPluginsChanged(cb: (plugins: PluginInfo[]) => void): Unsubscribe
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
  windowSetBadge: 'window:set-badge',
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
  scCountryCharts: 'sc:country-charts',
  scSearch: 'sc:search',
  scTrack: 'sc:track',
  scTracks: 'sc:tracks',
  scPlaylist: 'sc:playlist',
  scUser: 'sc:user',
  scUserTracks: 'sc:user-tracks',
  scUserReposts: 'sc:user-reposts',
  scRelated: 'sc:related',
  scComments: 'sc:comments',
  scCommentAdd: 'sc:comment-add',
  scRepostSet: 'sc:repost-set',
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
  libraryMovePlaylist: 'library:move-playlist',
  libraryPinPlaylist: 'library:pin-playlist',
  libraryAddHistory: 'library:add-history',
  libraryClearHistory: 'library:clear-history',
  libraryExport: 'library:export',
  libraryImport: 'library:import',
  playbackLoad: 'playback:load',
  playbackSave: 'playback:save',
  eqExport: 'eq:export',
  eqImport: 'eq:import',
  themePickBackground: 'theme:pick-background',
  themeExport: 'theme:export',
  themeImport: 'theme:import',
  windowSetIcon: 'window:set-icon',
  presenceUpdate: 'presence:update',
  lyricsGet: 'lyrics:get',
  pluginsList: 'plugins:list',
  pluginsSetEnabled: 'plugins:set-enabled',
  pluginsConfigure: 'plugins:configure',
  pluginsReload: 'plugins:reload',
  pluginsInstall: 'plugins:install',
  pluginsUninstall: 'plugins:uninstall',
  pluginsPlayerEvent: 'plugins:player-event',
  pluginsChanged: 'plugins:changed',
  pluginToast: 'plugin:toast',
  playerCommand: 'player:command',
  updatesStatus: 'updates:status',
  updatesCheck: 'updates:check',
  updatesDownload: 'updates:download',
  updatesInstall: 'updates:install',
  updateStatusEvent: 'update:status',
  downloadsTrack: 'downloads:track',
  downloadsOpenFolder: 'downloads:open-folder',
  socialStatus: 'social:status',
  socialCreateAccount: 'social:create-account',
  socialConfirmAccount: 'social:confirm-account',
  socialLogin: 'social:login',
  socialLogout: 'social:logout',
  socialDeleteAccount: 'social:delete-account',
  socialAddFriend: 'social:add-friend',
  socialRespondRequest: 'social:respond-request',
  socialRemoveFriend: 'social:remove-friend',
  socialCreateJam: 'social:create-jam',
  socialInviteToJam: 'social:invite-to-jam',
  socialRespondInvite: 'social:respond-invite',
  socialLeaveJam: 'social:leave-jam',
  socialEndJam: 'social:end-jam',
  socialSetJamControl: 'social:set-jam-control',
  socialJamKick: 'social:jam-kick',
  socialJamTransfer: 'social:jam-transfer',
  socialSetStatus: 'social:set-status',
  socialChatRead: 'social:chat-read',
  socialMyStats: 'social:my-stats',
  socialAdminUsers: 'social:admin-users',
  socialAdminForceUpdate: 'social:admin-force-update',
  socialAdminEvent: 'social:admin-event',
  socialAccountNumber: 'social:account-number',
  socialReconnect: 'social:reconnect',
  socialJamPlaybackSend: 'social:jam-playback-send',
  socialJamQueueSend: 'social:jam-queue-send',
  socialChatHistory: 'social:chat-history',
  socialChatSend: 'social:chat-send',
  socialChatTyping: 'social:chat-typing',
  socialJamChatSend: 'social:jam-chat-send',
  socialSetAvatar: 'social:set-avatar',
  socialRemoveAvatar: 'social:remove-avatar',
  socialRename: 'social:rename',
  socialState: 'social:state',
  socialJamPlayback: 'social:jam-playback',
  socialChatMessage: 'social:chat-message',
  socialChatSent: 'social:chat-sent',
  socialChatTypingEvent: 'social:chat-typing-event',
  socialChatRejected: 'social:chat-rejected',
  media: 'media',
  nav: 'nav',
  trayState: 'tray:state',
  trayAction: 'tray:action',
  trayClosing: 'tray:closing',
  themeAccentColors: 'theme:accent-colors',
  logRenderer: 'log:renderer'
} as const
