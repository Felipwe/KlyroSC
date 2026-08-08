import { useState, type JSX } from 'react'
import { type Track } from '@shared/types/track'
import { t, useLanguage, getLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { useLibrary } from '@renderer/stores/library'
import { useNav } from '@renderer/stores/nav'
import { useUi } from '@renderer/stores/ui'
import { usePlayer } from '@renderer/player/store'
import { useAsyncResult } from '@renderer/hooks/async'
import { TrackList } from '@renderer/components/TrackList'
import { Empty, ErrorState, Loading } from '@renderer/components/Status'
import { Artwork } from '@renderer/components/Artwork'
import { Icon } from '@renderer/components/Icon'
import { cx, formatDate, formatTime } from '@renderer/utils/format'

export function PlaylistsPage(): JSX.Element {
  useLanguage()
  const playlists = useLibrary((state) => state.data.playlists)
  const locale = getLanguage() === 'pt' ? 'pt-BR' : 'en-US'
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const createPlaylist = (): void =>
    useUi.getState().openModal({
      kind: 'prompt',
      title: t('playlists.create'),
      placeholder: t('playlists.name'),
      confirmLabel: t('common.create'),
      onConfirm: (name) => {
        if (name) void useLibrary.getState().createPlaylist(name)
      }
    })

  const finishDrag = (): void => {
    setDragIndex(null)
    setDropIndex(null)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t('playlists.title')}</h1>
        <button className="btn primary" onClick={createPlaylist}>
          <Icon name="plus" size={15} />
          {t('playlists.create')}
        </button>
      </div>
      {playlists.length === 0 ? (
        <Empty icon="queue" title={t('playlists.empty')} hint={t('playlists.emptyHint')} />
      ) : (
        <div className="grid-cards">
          {playlists.map((playlist, index) => (
            <div
              key={playlist.id}
              className={cx(
                'media-card card pl-draggable',
                dragIndex === index && 'dragging',
                dropIndex === index && dragIndex !== null && dragIndex !== index && 'drop-target'
              )}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', playlist.id)
                setDragIndex(index)
              }}
              onDragEnd={finishDrag}
              onDragOver={(event) => {
                if (dragIndex === null) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                if (dropIndex !== index) setDropIndex(index)
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return
                if (dropIndex === index) setDropIndex(null)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (dragIndex !== null && dragIndex !== index)
                  void useLibrary.getState().movePlaylist(dragIndex, index)
                finishDrag()
              }}
              onClick={() => useNav.getState().push({ name: 'playlist', ref: playlist.id, local: true })}
              onContextMenu={(event) => {
                event.preventDefault()
                useUi.getState().openMenu(event.clientX, event.clientY, [
                  {
                    id: 'pin',
                    label: playlist.pinned ? t('playlists.unpin') : t('playlists.pin'),
                    icon: 'pin',
                    action: () => void useLibrary.getState().setPlaylistPinned(playlist.id, !playlist.pinned)
                  }
                ])
              }}
            >
              <Artwork
                src={playlist.cover ?? playlist.tracks[0]?.artwork ?? null}
                alt=""
                fallbackIcon="queue"
              />
              <div className="mc-title">
                {playlist.pinned && (
                  <span className="mc-pin" title={t('playlists.pinnedBadge')}>
                    <Icon name="pin" size={11} />
                  </span>
                )}
                {playlist.name}
              </div>
              <div className="mc-sub">
                {playlist.tracks.length === 1
                  ? t('common.track')
                  : t('common.tracks', { count: playlist.tracks.length })}
                {' · '}
                {t('playlists.updated', { date: formatDate(playlist.updatedAt, locale) })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LocalPlaylistPage({ id }: { id: string }): JSX.Element {
  useLanguage()
  const playlist = useLibrary((state) => state.data.playlists.find((p) => p.id === id))
  const nav = useNav()

  if (!playlist) {
    return <Empty icon="queue" title={t('playlists.empty')} />
  }
  const totalDuration = playlist.tracks.reduce((sum, track) => sum + track.duration, 0)

  const rename = (): void =>
    useUi.getState().openModal({
      kind: 'prompt',
      title: t('common.rename'),
      initialValue: playlist.name,
      placeholder: t('playlists.name'),
      confirmLabel: t('common.save'),
      onConfirm: (name) => {
        if (name) void useLibrary.getState().renamePlaylist(playlist.id, name)
      }
    })

  const remove = (): void =>
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('common.delete'),
      body: t('playlists.deleteConfirm', { name: playlist.name }),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => {
        void useLibrary.getState().deletePlaylist(playlist.id)
        nav.back()
      }
    })

  return (
    <div className="page">
      <div className="playlist-hero">
        <div className="ph-cover">
          <Artwork
            src={playlist.cover ?? playlist.tracks[0]?.artwork ?? null}
            alt=""
            fallbackIcon="queue"
            iconSize={40}
          />
          <div className="ph-cover-actions">
            <button
              className="icon-btn"
              title={t('playlists.changeCover')}
              aria-label={t('playlists.changeCover')}
              onClick={() => void useLibrary.getState().setPlaylistCover(playlist.id)}
            >
              <Icon name="edit" size={16} />
            </button>
            {playlist.cover && (
              <button
                className="icon-btn"
                title={t('playlists.removeCover')}
                aria-label={t('playlists.removeCover')}
                onClick={() => void useLibrary.getState().removePlaylistCover(playlist.id)}
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="ph-info">
          <div className="ph-kind">{t('playlists.local')}</div>
          <h1>{playlist.name}</h1>
          <div className="ph-meta">
            <span>
              {playlist.tracks.length === 1
                ? t('common.track')
                : t('common.tracks', { count: playlist.tracks.length })}
            </span>
            {totalDuration > 0 && <span>{formatTime(totalDuration)}</span>}
          </div>
          <div className="ph-actions">
            {playlist.tracks.length > 0 && (
              <>
                <button
                  className="btn primary"
                  onClick={() => usePlayer.getState().playTracks(playlist.tracks)}
                >
                  <Icon name="play" size={15} />
                  {t('common.playAll')}
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    if (!usePlayer.getState().shuffle) usePlayer.getState().toggleShuffle()
                    usePlayer.getState().playTracks(playlist.tracks)
                  }}
                >
                  <Icon name="shuffle" size={15} />
                  {t('common.shufflePlay')}
                </button>
              </>
            )}
            <button className="btn" onClick={rename}>
              <Icon name="edit" size={15} />
              {t('common.rename')}
            </button>
            <button
              className={cx('btn', playlist.pinned && 'active')}
              onClick={() => void useLibrary.getState().setPlaylistPinned(playlist.id, !playlist.pinned)}
            >
              <Icon name="pin" size={15} />
              {playlist.pinned ? t('playlists.unpin') : t('playlists.pin')}
            </button>
            <button className="btn danger" onClick={remove}>
              <Icon name="trash" size={15} />
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>
      {playlist.tracks.length === 0 ? (
        <Empty icon="music" title={t('playlist.empty')} hint={t('playlist.emptyHint')} />
      ) : (
        <TrackList
          tracks={playlist.tracks}
          extraMenuFor={(_track, index) => [
            { id: 'sep', label: '' },
            {
              id: 'move-up',
              label: t('menu.moveUp'),
              icon: 'arrowUp',
              action: () => void useLibrary.getState().moveInPlaylist(playlist.id, index, index - 1)
            },
            {
              id: 'move-down',
              label: t('menu.moveDown'),
              icon: 'arrowDown',
              action: () => void useLibrary.getState().moveInPlaylist(playlist.id, index, index + 1)
            },
            {
              id: 'remove',
              label: t('menu.removeFromPlaylist'),
              icon: 'trash',
              danger: true,
              action: () => void useLibrary.getState().removeFromPlaylist(playlist.id, index)
            }
          ]}
        />
      )}
    </div>
  )
}

export function RemotePlaylistPage({ playlistRef }: { playlistRef: string }): JSX.Element {
  useLanguage()
  const { data, loading, error, reload } = useAsyncResult(() => api.sc.playlist(playlistRef), [playlistRef])
  const [hydrating, setHydrating] = useState(false)
  const [extraTracks, setExtraTracks] = useState<Track[]>([])

  if (loading) return <Loading />
  if (error || !data) return <ErrorState message={error ?? undefined} onRetry={reload} />

  const allTracks = [...data.tracks, ...extraTracks]
  const remainingIds = data.trackIds.filter((id) => !allTracks.some((track) => track.id === id))

  const loadRemaining = async (): Promise<void> => {
    setHydrating(true)
    const result = await api.sc.tracks(remainingIds.slice(0, 100))
    setHydrating(false)
    if (result.ok) setExtraTracks((previous) => [...previous, ...result.data])
  }

  return (
    <div className="page">
      <div className="playlist-hero">
        <Artwork src={data.artwork} alt="" fallbackIcon="queue" iconSize={40} />
        <div className="ph-info">
          <div className="ph-kind">{data.isAlbum ? t('common.album') : t('common.playlist')}</div>
          <h1>{data.title}</h1>
          <div className="ph-meta">
            {data.artist && <span>{t('common.by', { name: data.artist })}</span>}
            <span>
              {data.trackCount === 1 ? t('common.track') : t('common.tracks', { count: data.trackCount })}
            </span>
            {data.duration > 0 && <span>{formatTime(data.duration)}</span>}
          </div>
          <div className="ph-actions">
            <button className="btn primary" onClick={() => usePlayer.getState().playTracks(allTracks)}>
              <Icon name="play" size={15} />
              {t('common.playAll')}
            </button>
            <button
              className="btn"
              onClick={() => useUi.getState().openAddToPlaylist(allTracks)}
              disabled={allTracks.length === 0}
            >
              <Icon name="plus" size={15} />
              {t('playlist.addAllToPlaylist')}
            </button>
          </div>
        </div>
      </div>
      {data.description && <p className="artist-about" style={{ marginBottom: 22 }}>{data.description}</p>}
      <TrackList tracks={allTracks} />
      {remainingIds.length > 0 && (
        <div style={{ display: 'grid', placeItems: 'center', padding: 22 }}>
          <button className="btn" onClick={() => void loadRemaining()} disabled={hydrating}>
            {hydrating ? <div className="spinner small" /> : <Icon name="arrowDown" size={15} />}
            {t('common.loadMore')}
          </button>
        </div>
      )}
    </div>
  )
}
