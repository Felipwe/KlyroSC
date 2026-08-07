import { useEffect, useState, type JSX } from 'react'
import { t, useLanguage } from '@renderer/i18n'
import { api, reportError } from '@renderer/services/ipc'
import { useSettings } from '@renderer/stores/settings'
import { useLibrary } from '@renderer/stores/library'
import { useNav, type Route } from '@renderer/stores/nav'
import { useUi } from '@renderer/stores/ui'
import { toast } from '@renderer/stores/toasts'
import { initPlayer } from '@renderer/player/store'
import { initMediaSession } from '@renderer/player/media-session'
import { initPresenceSync } from '@renderer/player/presence-sync'
import { initDynamicTheme } from '@renderer/player/dynamic-theme'
import { initJamSync } from '@renderer/player/jam-sync'
import { initBadgeSync } from '@renderer/services/badge-sync'
import { useKeyboardShortcuts } from '@renderer/hooks/keyboard'
import { buildAppIcon } from '@renderer/utils/icon-tint'
import { TitleBar } from '@renderer/layouts/TitleBar'
import { Sidebar } from '@renderer/layouts/Sidebar'
import { PlayerBar } from '@renderer/layouts/PlayerBar'
import { QueuePanel } from '@renderer/layouts/QueuePanel'
import { LyricsOverlay } from '@renderer/layouts/LyricsOverlay'
import { MiniPlayer } from '@renderer/layouts/MiniPlayer'
import {
  AddToPlaylistHost,
  ContextMenuHost,
  ModalHost,
  ToastHost
} from '@renderer/components/overlays'
import { LoginPrompt } from '@renderer/components/LoginPrompt'
import { ChangelogCard } from '@renderer/components/ChangelogCard'
import { BootSplash } from '@renderer/components/BootSplash'
import { ChatPanel } from '@renderer/components/ChatPanel'
import { JamChatPanel } from '@renderer/components/JamChatPanel'
import { useAuth } from '@renderer/stores/auth'
import { JAM_CHAT_KEY, useSocial } from '@renderer/stores/social'
import { HomePage } from '@renderer/pages/HomePage'
import { SearchPage } from '@renderer/pages/SearchPage'
import { FavoritesPage, HistoryPage } from '@renderer/pages/LibraryPages'
import { PlaylistsPage, LocalPlaylistPage, RemotePlaylistPage } from '@renderer/pages/PlaylistPages'
import { ArtistPage } from '@renderer/pages/ArtistPage'
import { TrackPage } from '@renderer/pages/TrackPage'
import { SettingsPage } from '@renderer/pages/SettingsPage'
import { SocialPage } from '@renderer/pages/SocialPage'

function PageRouter({ route }: { route: Route }): JSX.Element {
  switch (route.name) {
    case 'home':
      return <HomePage />
    case 'search':
      return <SearchPage initialQuery={route.query} />
    case 'favorites':
      return <FavoritesPage />
    case 'social':
      return <SocialPage />
    case 'history':
      return <HistoryPage />
    case 'playlists':
      return <PlaylistsPage />
    case 'playlist':
      return route.local ? (
        <LocalPlaylistPage id={route.ref} />
      ) : (
        <RemotePlaylistPage playlistRef={route.ref} />
      )
    case 'artist':
      return <ArtistPage id={route.id} />
    case 'track':
      return <TrackPage id={route.id} />
    case 'settings':
      return <SettingsPage initialSection={route.section} />
  }
}

/** Floating chat windows live above every page, so the jam chat can open from the player bar. */
function ChatWindows(): JSX.Element {
  const openChats = useSocial((state) => state.openChats)
  return (
    <>
      {openChats.map((id, index) =>
        id === JAM_CHAT_KEY ? (
          <JamChatPanel key={id} zIndex={index} />
        ) : (
          <ChatPanel key={id} friendId={id} zIndex={index} />
        )
      )}
    </>
  )
}

const splashStart = Date.now()

export default function App(): JSX.Element {
  useLanguage()
  useKeyboardShortcuts()
  const [booted, setBooted] = useState(false)
  const [splash, setSplash] = useState<'show' | 'leaving' | 'gone'>('show')
  const [changelogVersion, setChangelogVersion] = useState<string | null>(null)
  const [maintenance, setMaintenance] = useState(false)
  const route = useNav((state) => state.route)
  const miniMode = useUi((state) => state.miniMode)
  const appearance = useSettings((state) => state.settings.appearance)

  // keep the window icon in sync with the custom theme accent
  useEffect(() => {
    if (!booted) return
    const tint = appearance.accent === 'custom' && appearance.custom.syncIcon ? appearance.custom.colorA : null
    void buildAppIcon(tint).then((dataUrl) => {
      if (dataUrl) api.window.setIcon(dataUrl)
    })
  }, [booted, appearance.accent, appearance.custom.syncIcon, appearance.custom.colorA])

  useEffect(() => {
    let cancelled = false
    const boot = async (): Promise<void> => {
      try {
        await useSettings.getState().load()
        await useLibrary.getState().load()
        await initPlayer()
        initMediaSession()
        initPresenceSync()
        initDynamicTheme()
        await useSocial.getState().load()
        initJamSync()
        initBadgeSync()
        await useAuth.getState().load()
        const info = await api.app.info()
        const seen = useSettings.getState().settings.system.lastSeenVersion
        if (seen === '') {
          void useSettings.getState().update({ system: { lastSeenVersion: info.version } })
        } else if (seen !== info.version && !cancelled) {
          setChangelogVersion(info.version)
        }
      } catch (error) {
        reportError('boot', error)
      }
      if (!cancelled) setBooted(true)
    }
    void boot()

    const unsubToast = api.events.onPluginToast((message) => toast(message))
    const unsubNav = api.events.onNav((payload) => {
      const nav = useNav.getState()
      if (payload.name === 'settings') nav.push({ name: 'settings', section: payload.params?.section })
      else if (payload.name === 'search') nav.push({ name: 'search' })
      else if (payload.name === 'favorites') nav.push({ name: 'favorites' })
      else if (payload.name === 'home') nav.push({ name: 'home' })
    })
    const unsubUpdates = api.updates.onStatus((status) => {
      if (status.phase === 'available' && status.latest)
        toast(t('toast.updateAvailable', { version: status.latest }))
      else if (status.phase === 'downloaded' && status.latest)
        toast(
          status.autoInstalling
            ? t('toast.updateRestarting', { version: status.latest })
            : t('toast.updateReady', { version: status.latest }),
          'success'
        )
    })
    // admin hard reset: big maintenance notice, then update + relaunch if a version is pending
    const unsubAdmin = api.social.onAdminEvent((action) => {
      if (action !== 'force-update') return
      setMaintenance(true)
      void (async (): Promise<void> => {
        const status = await api.updates.check()
        if (status.phase === 'available' || status.phase === 'downloading') {
          const downloaded = await api.updates.download()
          if (downloaded.phase === 'downloaded') {
            setTimeout(() => api.updates.install(), 1200)
            return
          }
        } else if (status.phase === 'downloaded') {
          setTimeout(() => api.updates.install(), 1200)
          return
        }
        // already on the latest version (or updater unavailable)  lift the notice
        setTimeout(() => {
          setMaintenance(false)
          toast(t('settings.admin.upToDate'), 'success')
        }, 3500)
      })()
    })
    const onWindowError = (event: ErrorEvent): void => reportError('window', event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent): void => reportError('promise', event.reason)
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      cancelled = true
      unsubToast()
      unsubNav()
      unsubUpdates()
      unsubAdmin()
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    if (!booted) return
    const wait = Math.max(0, 1200 - (Date.now() - splashStart))
    const leave = setTimeout(() => setSplash('leaving'), wait)
    const gone = setTimeout(() => setSplash('gone'), wait + 600)
    return () => {
      clearTimeout(leave)
      clearTimeout(gone)
    }
  }, [booted])

  if (!booted) {
    return (
      <>
        <div className="ambient" />
        <BootSplash leaving={false} />
      </>
    )
  }

  if (miniMode) return <MiniPlayer />

  return (
    <>
      <div className="ambient" />
      <div className="app">
        <TitleBar />
        <Sidebar />
        <main className="main" key={JSON.stringify(route)}>
          <PageRouter route={route} />
        </main>
        <PlayerBar />
      </div>
      <QueuePanel />
      <LyricsOverlay />
      <ChatWindows />
      <LoginPrompt />
      {changelogVersion && (
        <ChangelogCard
          version={changelogVersion}
          onClose={() => {
            setChangelogVersion(null)
            void useSettings.getState().update({ system: { lastSeenVersion: changelogVersion } })
          }}
        />
      )}
      <ContextMenuHost />
      <ModalHost />
      <AddToPlaylistHost />
      <ToastHost />
      {maintenance && (
        <div className="maintenance-overlay" role="alertdialog" aria-modal="true">
          <div className="mo-card">
            <div className="spinner" />
            <h2>{t('settings.admin.maintenanceTitle')}</h2>
            <p>{t('settings.admin.maintenanceBody')}</p>
          </div>
        </div>
      )}
      {splash !== 'gone' && <BootSplash leaving={splash === 'leaving'} />}
    </>
  )
}
