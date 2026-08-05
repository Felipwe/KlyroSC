import { useEffect, useRef, useState, type JSX, type PointerEvent } from 'react'
import { t, useLanguage } from '@renderer/i18n'
import { useNav, type Route } from '@renderer/stores/nav'
import { useLibrary } from '@renderer/stores/library'
import { useAuth } from '@renderer/stores/auth'
import { useUi } from '@renderer/stores/ui'
import { cx } from '@renderer/utils/format'
import { Icon, type IconName } from '@renderer/components/Icon'
import { Artwork } from '@renderer/components/Artwork'

const NAV_ITEMS: { route: Route; icon: IconName; key: string }[] = [
  { route: { name: 'home' }, icon: 'home', key: 'nav.home' },
  { route: { name: 'search' }, icon: 'search', key: 'nav.search' },
  { route: { name: 'favorites' }, icon: 'heart', key: 'nav.favorites' },
  { route: { name: 'social' }, icon: 'users', key: 'nav.social' },
  { route: { name: 'history' }, icon: 'clock', key: 'nav.history' },
  { route: { name: 'playlists' }, icon: 'queue', key: 'nav.playlists' }
]

const SIDEBAR_DEFAULT = 232
const SIDEBAR_MIN = 170
const SIDEBAR_MAX = 340
const SIDEBAR_COMPACT = 68
/** dragging narrower than this snaps into the icons-only rail */
const COMPACT_SNAP = 150
const STORAGE_KEY = 'klyro.sidebar-w'

const loadWidth = (): number => {
  const raw = Number(localStorage.getItem(STORAGE_KEY))
  if (!Number.isFinite(raw) || raw <= 0) return SIDEBAR_DEFAULT
  if (raw <= SIDEBAR_COMPACT) return SIDEBAR_COMPACT
  return Math.min(Math.max(raw, SIDEBAR_MIN), SIDEBAR_MAX)
}

export function Sidebar(): JSX.Element {
  useLanguage()
  const route = useNav((state) => state.route)
  const push = useNav((state) => state.push)
  const playlists = useLibrary((state) => state.data.playlists)
  const authState = useAuth((state) => state.state)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [width, setWidth] = useState(loadWidth)
  const [resizing, setResizing] = useState(false)
  const resizeRef = useRef<number | null>(null)
  const compact = width <= SIDEBAR_COMPACT

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${width}px`)
    const timer = setTimeout(() => localStorage.setItem(STORAGE_KEY, String(width)), 250)
    return () => clearTimeout(timer)
  }, [width])

  const onResizeDown = (event: PointerEvent<HTMLDivElement>): void => {
    resizeRef.current = event.pointerId
    setResizing(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* synthetic events have no active pointer */
    }
  }

  const onResizeMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (resizeRef.current !== event.pointerId) return
    const x = event.clientX
    setWidth(x < COMPACT_SNAP ? SIDEBAR_COMPACT : Math.min(Math.max(x, SIDEBAR_MIN), SIDEBAR_MAX))
  }

  const onResizeUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (resizeRef.current === event.pointerId) {
      resizeRef.current = null
      setResizing(false)
    }
  }

  const finishDrag = (): void => {
    setDragIndex(null)
    setDropIndex(null)
  }

  return (
    <aside className={cx('sidebar', compact && 'compact')}>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={cx('side-item', route.name === item.route.name && 'active')}
          onClick={() => push(item.route)}
          title={t(item.key)}
        >
          <Icon name={item.icon} />
          <span className="side-label">{t(item.key)}</span>
        </button>
      ))}

      {!compact && (
        <div className="side-section">
          {t('nav.library')}
          <button
            aria-label={t('playlists.create')}
            title={t('playlists.create')}
            onClick={() =>
              useUi.getState().openModal({
                kind: 'prompt',
                title: t('playlists.create'),
                placeholder: t('playlists.name'),
                confirmLabel: t('common.create'),
                onConfirm: (name) => {
                  if (name) void useLibrary.getState().createPlaylist(name)
                }
              })
            }
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
      )}
      {playlists.slice(0, 12).map((playlist, index) => (
        <button
          key={playlist.id}
          className={cx(
            'side-item side-playlist',
            route.name === 'playlist' && route.ref === playlist.id && 'active',
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
          onDrop={(event) => {
            event.preventDefault()
            if (dragIndex !== null && dragIndex !== index)
              void useLibrary.getState().movePlaylist(dragIndex, index)
            finishDrag()
          }}
          onClick={() => push({ name: 'playlist', ref: playlist.id, local: true })}
          title={playlist.name}
        >
          <span className="pl-dot">
            {playlist.cover ? (
              <img src={playlist.cover} alt="" draggable={false} />
            ) : (
              <Icon name="music" size={13} />
            )}
          </span>
          <span className="side-label">{playlist.name}</span>
        </button>
      ))}

      <div className="sidebar-footer">
        <button
          className="side-item side-account"
          onClick={() => push({ name: 'settings', section: 'account' })}
          title={authState.loggedIn && authState.user ? authState.user.name : t('auth.connect')}
        >
          {authState.loggedIn && authState.user ? (
            <>
              <Artwork
                src={authState.user.avatar}
                round
                fallbackIcon="user"
                iconSize={12}
                className="side-avatar"
              />
              <span className="side-label">{authState.user.name}</span>
            </>
          ) : (
            <>
              <Icon name="user" />
              <span className="side-label">{t('auth.connect')}</span>
            </>
          )}
        </button>
        <button
          className={cx('side-item', route.name === 'settings' && 'active')}
          onClick={() => push({ name: 'settings' })}
          title={t('nav.settings')}
        >
          <Icon name="settings" />
          <span className="side-label">{t('nav.settings')}</span>
        </button>
      </div>

      <div
        className={cx('sidebar-resize', resizing && 'active')}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        onDoubleClick={() => setWidth(SIDEBAR_DEFAULT)}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('nav.resizeSidebar')}
      />
    </aside>
  )
}
