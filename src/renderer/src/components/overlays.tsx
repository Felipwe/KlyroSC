import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react'
import { useUi } from '@renderer/stores/ui'
import { useToasts } from '@renderer/stores/toasts'
import { useLibrary } from '@renderer/stores/library'
import { t } from '@renderer/i18n'
import { cx } from '@renderer/utils/format'
import { Icon, type IconName } from './Icon'

export function ContextMenuHost(): JSX.Element | null {
  const menu = useUi((state) => state.menu)
  const closeMenu = useUi((state) => state.closeMenu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: menu.x, y: menu.y })

  useEffect(() => {
    setPos({ x: menu.x, y: menu.y })
  }, [menu.x, menu.y, menu.items])

  useLayoutEffect(() => {
    if (!menu.open) return
    const el = ref.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const x = Math.min(menu.x, window.innerWidth - rect.width - 8)
      const y = Math.min(menu.y, window.innerHeight - rect.height - 8)
      setPos({ x: Math.max(8, x), y: Math.max(8, y) })
    }
  }, [menu.open, menu.x, menu.y, menu.items])

  useEffect(() => {
    if (!menu.open) return
    const onDown = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) closeMenu()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', closeMenu)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', closeMenu)
    }
  }, [menu.open, closeMenu])

  if (!menu.open) return null
  return (
    <div ref={ref} className="ctx-menu glass" style={{ left: pos.x, top: pos.y }} role="menu">
      {menu.items.map((item, index) =>
        item.id === 'sep' ? (
          <div key={`sep-${index}`} className="ctx-sep" />
        ) : (
          <button
            key={item.id}
            role="menuitem"
            className={cx(item.danger && 'danger')}
            onClick={() => {
              closeMenu()
              item.action?.()
            }}
          >
            {item.icon && <Icon name={item.icon as IconName} size={15} />}
            {item.label}
          </button>
        )
      )}
    </div>
  )
}

export function ModalHost(): JSX.Element | null {
  const modal = useUi((state) => state.modal)
  const closeModal = useUi((state) => state.closeModal)
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue(modal?.initialValue ?? '')
  }, [modal])

  if (!modal) return null
  const confirm = (): void => {
    closeModal()
    modal.onConfirm(value.trim())
  }
  return (
    <div
      className="scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <div className="modal glass" role="dialog" aria-modal="true">
        <h3>{modal.title}</h3>
        {modal.body && <p>{modal.body}</p>}
        {modal.kind === 'prompt' && (
          <input
            className="text-input"
            autoFocus
            value={value}
            placeholder={modal.placeholder}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && value.trim()) confirm()
              if (event.key === 'Escape') closeModal()
            }}
          />
        )}
        <div className="modal-actions">
          <button className="btn" onClick={closeModal}>
            {t('common.cancel')}
          </button>
          <button
            className={cx('btn', modal.danger ? 'danger' : 'primary')}
            disabled={modal.kind === 'prompt' && value.trim().length === 0}
            onClick={confirm}
          >
            {modal.confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AddToPlaylistHost(): JSX.Element | null {
  const tracks = useUi((state) => state.addToPlaylistTrack)
  const close = useUi((state) => state.closeAddToPlaylist)
  const playlists = useLibrary((state) => state.data.playlists)
  const [name, setName] = useState('')

  if (!tracks) return null
  return (
    <div
      className="scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="modal glass" role="dialog" aria-modal="true">
        <h3>{t('menu.addToPlaylist')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              className="btn"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => {
                void useLibrary.getState().addToPlaylist(playlist.id, tracks)
                close()
              }}
            >
              <Icon name="queue" size={15} />
              {playlist.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            className="text-input"
            placeholder={t('menu.newPlaylist')}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Escape' && close()}
          />
          <button
            className="btn primary"
            disabled={name.trim().length === 0}
            onClick={() => {
              const library = useLibrary.getState()
              void library.createPlaylist(name.trim()).then(() => {
                const created = useLibrary.getState().data.playlists[0]
                if (created) void library.addToPlaylist(created.id, tracks)
              })
              close()
            }}
          >
            {t('common.create')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ToastHost(): JSX.Element {
  const toasts = useToasts((state) => state.toasts)
  const dismiss = useToasts((state) => state.dismiss)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx('toast glass', toast.kind)} onClick={() => dismiss(toast.id)}>
          <span className="toast-dot" />
          {toast.message}
        </div>
      ))}
    </div>
  )
}
