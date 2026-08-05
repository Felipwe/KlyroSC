import { describe, expect, it } from 'vitest'
import { artworkUrl, mapArtist, mapPlaylist, mapTrack, mapTranscodings } from '../src/main/services/soundcloud/mappers'

const rawTrack = {
  id: 123,
  title: 'Midnight Drive',
  permalink_url: 'https://soundcloud.com/artist/midnight-drive',
  artwork_url: 'https://i1.sndcdn.com/artworks-abc-large.jpg',
  duration: 30000,
  full_duration: 215000,
  genre: 'Synthwave',
  playback_count: 1500,
  likes_count: 200,
  created_at: '2025-04-01T00:00:00Z',
  policy: 'ALLOW',
  publisher_metadata: {
    artist: 'Nightrider feat. Neon Moon'
  },
  user: {
    id: 77,
    username: 'Nightrider',
    permalink_url: 'https://soundcloud.com/nightrider',
    avatar_url: 'https://i1.sndcdn.com/avatars-xyz-large.jpg'
  },
  media: {
    transcodings: [
      {
        url: 'https://api-v2.soundcloud.com/media/1/stream/hls',
        format: { protocol: 'hls', mime_type: 'audio/mpegurl' },
        quality: 'sq'
      },
      {
        url: 'https://api-v2.soundcloud.com/media/1/stream/progressive',
        format: { protocol: 'progressive', mime_type: 'audio/mpeg' },
        quality: 'sq'
      }
    ]
  }
}

describe('mapTrack', () => {
  it('maps raw api track to domain', () => {
    const track = mapTrack(rawTrack)
    expect(track).not.toBeNull()
    expect(track?.id).toBe(123)
    expect(track?.artist).toBe('Nightrider')
    expect(track?.lyricsArtist).toBe('Nightrider feat. Neon Moon')
    expect(track?.duration).toBe(215)
    expect(track?.artwork).toBe('https://i1.sndcdn.com/artworks-abc-t500x500.jpg')
    expect(track?.artworkSmall).toBe('https://i1.sndcdn.com/artworks-abc-t120x120.jpg')
    expect(track?.snippet).toBe(true)
  })

  it('detects snippet from SNIP policy', () => {
    const track = mapTrack({ ...rawTrack, duration: 215000, policy: 'SNIP' })
    expect(track?.snippet).toBe(true)
  })

  it('is not a snippet when durations match', () => {
    const track = mapTrack({ ...rawTrack, duration: 215000, full_duration: 215000 })
    expect(track?.snippet).toBe(false)
  })

  it('returns null for invalid data', () => {
    expect(mapTrack(null)).toBeNull()
    expect(mapTrack({})).toBeNull()
    expect(mapTrack({ id: 'x', title: 3 })).toBeNull()
  })

  it('falls back to avatar artwork', () => {
    const track = mapTrack({ ...rawTrack, artwork_url: null })
    expect(track?.artwork).toBe('https://i1.sndcdn.com/avatars-xyz-t500x500.jpg')
  })
})

describe('mapTranscodings', () => {
  it('extracts protocols and urls', () => {
    const list = mapTranscodings(rawTrack.media)
    expect(list).toHaveLength(2)
    expect(list[0]?.protocol).toBe('hls')
    expect(list[1]?.protocol).toBe('progressive')
  })

  it('handles missing media', () => {
    expect(mapTranscodings(undefined)).toEqual([])
    expect(mapTranscodings({})).toEqual([])
  })
})

describe('mapArtist', () => {
  it('maps user payload', () => {
    const artist = mapArtist({
      id: 77,
      username: 'Nightrider',
      permalink: 'nightrider',
      permalink_url: 'https://soundcloud.com/nightrider',
      avatar_url: 'https://i1.sndcdn.com/avatars-xyz-large.jpg',
      verified: true,
      followers_count: 1000,
      track_count: 12,
      city: 'Lisbon',
      description: 'synths'
    })
    expect(artist?.name).toBe('Nightrider')
    expect(artist?.verified).toBe(true)
    expect(artist?.avatar).toContain('t500x500')
  })
})

describe('mapPlaylist', () => {
  it('maps playlist with stub tracks', () => {
    const playlist = mapPlaylist({
      id: 900,
      title: 'Mix',
      track_count: 3,
      duration: 600000,
      user: { id: 77, username: 'Nightrider' },
      tracks: [rawTrack, { id: 456 }, { id: 789 }]
    })
    expect(playlist?.ref).toBe('900')
    expect(playlist?.trackIds).toEqual([123, 456, 789])
    expect(playlist?.tracks).toHaveLength(1)
    expect(playlist?.duration).toBe(600)
  })

  it('uses urn for system playlists', () => {
    const playlist = mapPlaylist({
      urn: 'soundcloud:system-playlists:artist-stations:123',
      kind: 'system-playlist',
      title: 'Artist Station',
      calculated_artwork_url: 'https://i1.sndcdn.com/artworks-def-large.jpg',
      tracks: [{ id: 1 }]
    })
    expect(playlist?.ref).toBe('soundcloud:system-playlists:artist-stations:123')
    expect(playlist?.artist).toBe('SoundCloud')
  })
})

describe('artworkUrl', () => {
  it('upscales any known suffix', () => {
    expect(artworkUrl('https://x/a-large.jpg', 't500x500')).toBe('https://x/a-t500x500.jpg')
    expect(artworkUrl('https://x/a-t120x120.png', 't500x500')).toBe('https://x/a-t500x500.png')
    expect(artworkUrl(null, 't500x500')).toBeNull()
  })
})
