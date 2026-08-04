import { type Track } from '@shared/types/track'
import { t } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { usePlayer } from '@renderer/player/store'
import { useLibrary } from '@renderer/stores/library'
import { useNav } from '@renderer/stores/nav'
import { toast } from '@renderer/stores/toasts'
import { useUi, type MenuItem } from '@renderer/stores/ui'

export function buildTrackMenu(track: Track, extra: MenuItem[] = []): MenuItem[] {
  const player = usePlayer.getState()
  const library = useLibrary.getState()
  const nav = useNav.getState()
  const ui = useUi.getState()
  const isFavorite = library.favoriteIds.has(track.id)

  const items: MenuItem[] = [
    { id: 'play', label: t('menu.play'), icon: 'play', action: () => player.playNow(track) },
    { id: 'play-next', label: t('menu.playNext'), icon: 'next', action: () => player.playNext(track) },
    { id: 'add-queue', label: t('menu.addToQueue'), icon: 'queue', action: () => player.addToQueue([track]) },
    {
      id: 'add-playlist',
      label: t('menu.addToPlaylist'),
      icon: 'plus',
      action: () => ui.openAddToPlaylist([track])
    },
    {
      id: 'favorite',
      label: isFavorite ? t('player.unfavorite') : t('player.favorite'),
      icon: isFavorite ? 'heartFill' : 'heart',
      action: () => void library.toggleFavorite(track)
    }
  ]

  if (track.artistId > 0) {
    items.push({
      id: 'artist',
      label: t('menu.goToArtist'),
      icon: 'user',
      action: () => nav.push({ name: 'artist', id: track.artistId })
    })
  }

  items.push(
    {
      id: 'copy',
      label: t('menu.copyLink'),
      icon: 'external',
      action: () => {
        void navigator.clipboard.writeText(track.url).then(() => toast(t('toast.linkCopied')))
      }
    },
    {
      id: 'browser',
      label: t('menu.openInBrowser'),
      icon: 'external',
      action: () => api.app.openExternal(track.url)
    }
  )

  if (!track.snippet) {
    items.push({
      id: 'download',
      label: t('menu.download'),
      icon: 'download',
      action: () => {
        toast(t('toast.downloadStarted', { title: track.title }))
        void api.downloads.track(track.id, `${track.artist} - ${track.title}`).then((result) => {
          if (result.ok) toast(t('toast.downloadDone', { title: track.title }), 'success')
          else toast(t('toast.downloadFailed', { error: result.error }), 'error')
        })
      }
    })
  }

  return [...items, ...extra]
}

export function openTrackMenuAt(event: React.MouseEvent, track: Track, extra: MenuItem[] = []): void {
  event.preventDefault()
  event.stopPropagation()
  useUi.getState().openMenu(event.clientX, event.clientY, buildTrackMenu(track, extra))
}
