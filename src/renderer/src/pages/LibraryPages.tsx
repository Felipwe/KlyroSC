import { type JSX } from 'react'
import { type Track } from '@shared/types/track'
import { t, useLanguage, getLanguage } from '@renderer/i18n'
import { useLibrary } from '@renderer/stores/library'
import { useUi } from '@renderer/stores/ui'
import { usePlayer } from '@renderer/player/store'
import { TrackList } from '@renderer/components/TrackList'
import { Empty } from '@renderer/components/Status'
import { Icon } from '@renderer/components/Icon'

export function FavoritesPage(): JSX.Element {
  useLanguage()
  const favorites = useLibrary((state) => state.data.favorites)
  const tracks = favorites.map((favorite) => favorite.track)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('favorites.title')}</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {tracks.length === 1 ? t('common.track') : t('common.tracks', { count: tracks.length })}
          </p>
        </div>
        {tracks.length > 0 && (
          <div className="page-head-actions">
            <button className="btn primary" onClick={() => usePlayer.getState().playTracks(tracks)}>
              <Icon name="play" size={15} />
              {t('common.playAll')}
            </button>
          </div>
        )}
      </div>
      {tracks.length === 0 ? (
        <Empty icon="heart" title={t('favorites.empty')} hint={t('favorites.emptyHint')} />
      ) : (
        <TrackList tracks={tracks} />
      )}
    </div>
  )
}

function groupHistory(
  history: { track: Track; playedAt: number }[],
  locale: string
): Map<string, { track: Track; playedAt: number }[]> {
  const groups = new Map<string, { track: Track; playedAt: number }[]>()
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86_400_000).toDateString()
  for (const entry of history) {
    const day = new Date(entry.playedAt).toDateString()
    const label =
      day === today
        ? t('history.today')
        : day === yesterday
          ? t('history.yesterday')
          : new Date(entry.playedAt).toLocaleDateString(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })
    const group = groups.get(label) ?? []
    group.push(entry)
    groups.set(label, group)
  }
  return groups
}

export function HistoryPage(): JSX.Element {
  useLanguage()
  const history = useLibrary((state) => state.data.history)
  const clearHistory = useLibrary((state) => state.clearHistory)
  const locale = getLanguage() === 'pt' ? 'pt-BR' : 'en-US'
  const groups = groupHistory(history, locale)

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t('history.title')}</h1>
        {history.length > 0 && (
          <button
            className="btn danger small"
            onClick={() =>
              useUi.getState().openModal({
                kind: 'confirm',
                title: t('history.clear'),
                body: t('history.clearConfirm'),
                danger: true,
                confirmLabel: t('history.clear'),
                onConfirm: () => void clearHistory()
              })
            }
          >
            <Icon name="trash" size={14} />
            {t('history.clear')}
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <Empty icon="clock" title={t('history.empty')} hint={t('history.emptyHint')} />
      ) : (
        [...groups.entries()].map(([label, entries]) => (
          <div key={label} className="history-group">
            <h4>{label}</h4>
            <TrackList tracks={entries.map((entry) => entry.track)} />
          </div>
        ))
      )}
    </div>
  )
}
