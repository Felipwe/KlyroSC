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
import { useKeyboardShortcuts } from '@renderer/hooks/keyboard'
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
import { useAuth } from '@renderer/stores/auth'
import { HomePage } from '@renderer/pages/HomePage'
import { SearchPage } from '@renderer/pages/SearchPage'
import { FavoritesPage, HistoryPage } from '@renderer/pages/LibraryPages'
import { PlaylistsPage, LocalPlaylistPage, RemotePlaylistPage } from '@renderer/pages/PlaylistPages'
import { ArtistPage } from '@renderer/pages/ArtistPage'
import { TrackPage } from '@renderer/pages/TrackPage'
import { SettingsPage } from '@renderer/pages/SettingsPage'

function PageRouter({ route }: { route: Route }): JSX.Element {
  switch (route.name) {
    case 'home':
      return <HomePage />
    case 'search':
      return <SearchPage initialQuery={route.query} />
    case 'favorites':
      return <FavoritesPage />
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

const splashStart = Date.now()

export default function App(): JSX.Element {
  useLanguage()
  useKeyboardShortcuts()
  const [booted, setBooted] = useState(false)
  const [splash, setSplash] = useState<'show' | 'leaving' | 'gone'>('show')
  const [changelogVersion, setChangelogVersion] = useState<string | null>(null)
  const route = useNav((state) => state.route)
  const miniMode = useUi((state) => state.miniMode)

  useEffect(() => {
    let cancelled = false
    const boot = async (): Promise<void> => {
      try {
        await useSettings.getState().load()
        await useLibrary.getState().load()
        await initPlayer()
        initMediaSession()
        initPresenceSync()
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
    const onWindowError = (event: ErrorEvent): void => reportError('window', event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent): void => reportError('promise', event.reason)
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      cancelled = true
      unsubToast()
      unsubNav()
      unsubUpdates()
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
      {splash !== 'gone' && <BootSplash leaving={splash === 'leaving'} />}
    </>
  )
}
