import { useEffect, useRef, useState, type JSX } from 'react'
import { type Artist, type PlaylistLite, type SearchKind, type Track } from '@shared/types/track'
import { t, useLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { useNav } from '@renderer/stores/nav'
import { toast } from '@renderer/stores/toasts'
import { useSearchHistory } from '@renderer/stores/search-history'
import { useDebouncedValue } from '@renderer/hooks/async'
import { TrackList } from '@renderer/components/TrackList'
import { ArtistCard, PlaylistCard } from '@renderer/components/cards'
import { Empty, ErrorState, Loading } from '@renderer/components/Status'
import { Icon } from '@renderer/components/Icon'
import { usePlayer } from '@renderer/player/store'
import { cx } from '@renderer/utils/format'

type AnyItem = Track | Artist | PlaylistLite

interface SearchResults {
  items: AnyItem[]
  nextHref: string | null
}

export function SearchPage({ initialQuery }: { initialQuery?: string }): JSX.Element {
  useLanguage()
  const [query, setQuery] = useState(initialQuery ?? '')
  const [kind, setKind] = useState<SearchKind>('tracks')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounced = useDebouncedValue(query.trim(), 350)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)
  const history = useSearchHistory((state) => state.entries)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleLink = async (url: string): Promise<void> => {
    setLoading(true)
    const resolved = await api.sc.resolve(url)
    setLoading(false)
    setQuery('')
    if (!resolved.ok || resolved.data.kind === 'unknown') {
      toast(t('toast.linkResolveFailed'), 'error')
      return
    }
    const nav = useNav.getState()
    if (resolved.data.kind === 'track') usePlayer.getState().playStation(resolved.data.track)
    else if (resolved.data.kind === 'playlist')
      nav.push({ name: 'playlist', ref: resolved.data.ref, local: false })
    else if (resolved.data.kind === 'artist') nav.push({ name: 'artist', id: resolved.data.id })
  }
  const handleLinkRef = useRef(handleLink)
  useEffect(() => {
    handleLinkRef.current = handleLink
  })

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null)
      setError(null)
      return
    }
    if (/^https:\/\/(www\.|on\.|m\.)?soundcloud\.com\//.test(debounced)) {
      void handleLinkRef.current(debounced)
      return
    }
    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)
    void api.sc.search(kind, debounced).then((result) => {
      if (requestId !== requestRef.current) return
      setLoading(false)
      if (result.ok) {
        setResults({ items: result.data.items, nextHref: result.data.nextHref })
        if (result.data.items.length > 0) useSearchHistory.getState().add(debounced)
      } else setError(result.error)
    })
  }, [debounced, kind])

  const loadMore = async (): Promise<void> => {
    if (!results?.nextHref || loadingMore) return
    setLoadingMore(true)
    const page = await api.sc.search(kind, debounced, results.nextHref)
    setLoadingMore(false)
    if (page.ok) {
      setResults({
        items: [...results.items, ...page.data.items],
        nextHref: page.data.nextHref
      })
    }
  }

  const tracks = kind === 'tracks' ? (results?.items as Track[] | undefined) : undefined

  return (
    <div className="page">
      <div className="search-bar" style={{ marginBottom: 18 }}>
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          data-search-input
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(event) => setQuery(event.currentTarget.value)}
          spellCheck={false}
        />
        {query && (
          <button className="icon-btn" onClick={() => setQuery('')} aria-label={t('common.close')}>
            <Icon name="close" size={15} />
          </button>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: 22 }}>
        {(['tracks', 'artists', 'playlists'] as const).map((tab) => (
          <button key={tab} className={cx(kind === tab && 'active')} onClick={() => setKind(tab)}>
            {t(`search.${tab}`)}
          </button>
        ))}
      </div>

      {debounced.length < 2 ? (
        history.length > 0 ? (
          <div className="search-history">
            <div className="sh-title">{t('search.recent')}</div>
            {history.map((entry) => (
              <div
                key={entry}
                className="sh-row"
                role="button"
                tabIndex={0}
                onClick={() => setQuery(entry)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setQuery(entry)
                }}
              >
                <Icon name="clock" size={15} />
                <span className="sh-query">{entry}</span>
                <button
                  className="icon-btn sh-remove"
                  title={t('search.removeFromHistory')}
                  aria-label={t('search.removeFromHistory')}
                  onClick={(event) => {
                    event.stopPropagation()
                    useSearchHistory.getState().remove(entry)
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon="search" title={t('search.startTitle')} hint={t('search.startHint')} />
        )
      ) : loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setQuery(`${query} `.trimEnd())} />
      ) : !results || results.items.length === 0 ? (
        <Empty icon="disc" title={t('search.noResults', { query: debounced })} hint={t('search.noResultsHint')} />
      ) : (
        <>
          {tracks ? (
            <TrackList
              tracks={tracks}
              onPlayIndex={(index) => {
                const track = tracks[index]
                if (track) usePlayer.getState().playStation(track)
              }}
            />
          ) : (
            <div className="grid-cards">
              {kind === 'artists' &&
                (results.items as Artist[]).map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
              {kind === 'playlists' &&
                (results.items as PlaylistLite[]).map((playlist) => (
                  <PlaylistCard key={playlist.ref} playlist={playlist} />
                ))}
            </div>
          )}
          {results.nextHref && (
            <div style={{ display: 'grid', placeItems: 'center', padding: 22 }}>
              <button className="btn" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? <div className="spinner small" /> : <Icon name="arrowDown" size={15} />}
                {t('common.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
