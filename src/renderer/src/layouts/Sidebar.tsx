import { type JSX } from 'react'
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
  { route: { name: 'history' }, icon: 'clock', key: 'nav.history' },
  { route: { name: 'playlists' }, icon: 'queue', key: 'nav.playlists' }
]

export function Sidebar(): JSX.Element {
  useLanguage()
  const route = useNav((state) => state.route)
  const push = useNav((state) => state.push)
  const playlists = useLibrary((state) => state.data.playlists)
  const authState = useAuth((state) => state.state)

  return (
    <aside className="sidebar">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={cx('side-item', route.name === item.route.name && 'active')}
          onClick={() => push(item.route)}
        >
          <Icon name={item.icon} />
          {t(item.key)}
        </button>
      ))}

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
      {playlists.slice(0, 12).map((playlist) => (
        <button
          key={playlist.id}
          className={cx(
            'side-item side-playlist',
            route.name === 'playlist' && route.ref === playlist.id && 'active'
          )}
          onClick={() => push({ name: 'playlist', ref: playlist.id, local: true })}
        >
          <span className="pl-dot">
            {playlist.cover ? (
              <img src={playlist.cover} alt="" draggable={false} />
            ) : (
              <Icon name="music" size={13} />
            )}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {playlist.name}
          </span>
        </button>
      ))}

      <div className="sidebar-footer">
        <button
          className="side-item side-account"
          onClick={() => push({ name: 'settings', section: 'account' })}
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
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {authState.user.name}
              </span>
            </>
          ) : (
            <>
              <Icon name="user" />
              {t('auth.connect')}
            </>
          )}
        </button>
        <button
          className={cx('side-item', route.name === 'settings' && 'active')}
          onClick={() => push({ name: 'settings' })}
        >
          <Icon name="settings" />
          {t('nav.settings')}
        </button>
      </div>
    </aside>
  )
}
