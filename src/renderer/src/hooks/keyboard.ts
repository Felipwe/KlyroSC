import { useEffect } from 'react'
import { usePlayer } from '@renderer/player/store'
import { useLibrary } from '@renderer/stores/library'
import { useNav } from '@renderer/stores/nav'
import { useUi } from '@renderer/stores/ui'

const isTyping = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const player = usePlayer.getState()
      const ui = useUi.getState()
      const nav = useNav.getState()

      if (event.key === 'Escape') {
        if (ui.menu.open) return
        if (ui.modal || ui.addToPlaylistTrack) return
        if (ui.lyricsOpen) {
          ui.toggleLyrics(false)
          event.preventDefault()
          return
        }
        if (ui.queueOpen) {
          ui.toggleQueue(false)
          event.preventDefault()
          return
        }
        return
      }

      if (isTyping(event.target)) return

      const ctrl = event.ctrlKey || event.metaKey

      if (event.code === 'Space') {
        event.preventDefault()
        player.toggle()
        return
      }
      if (ctrl && event.key === 'ArrowRight') return void (event.preventDefault(), player.next())
      if (ctrl && event.key === 'ArrowLeft') return void (event.preventDefault(), player.previous())
      if (ctrl && event.key === 'ArrowUp')
        return void (event.preventDefault(), player.setVolume(Math.min(1, player.volume + 0.05)))
      if (ctrl && event.key === 'ArrowDown')
        return void (event.preventDefault(), player.setVolume(Math.max(0, player.volume - 0.05)))
      if (ctrl && (event.key === 'f' || event.key === 'F'))
        return void (event.preventDefault(), nav.push({ name: 'search' }), focusSearch())
      if (ctrl && event.key === ',') return void (event.preventDefault(), nav.push({ name: 'settings' }))

      if (event.altKey && event.key === 'ArrowLeft') return void (event.preventDefault(), nav.back())
      if (event.altKey && event.key === 'ArrowRight') return void (event.preventDefault(), nav.forward())

      if (ctrl || event.altKey) return

      switch (event.key.toLowerCase()) {
        case 'arrowright':
          if (player.current) {
            event.preventDefault()
            player.seek(Math.min(player.duration, player.position + 5))
          }
          break
        case 'arrowleft':
          if (player.current) {
            event.preventDefault()
            player.seek(Math.max(0, player.position - 5))
          }
          break
        case 'm':
          player.toggleMute()
          break
        case 's':
          player.toggleShuffle()
          break
        case 'r':
          player.cycleRepeat()
          break
        case 'q':
          ui.toggleQueue()
          break
        case 'l':
          if (player.current) ui.toggleLyrics()
          break
        case 'f':
          if (player.current) void useLibrary.getState().toggleFavorite(player.current)
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

function focusSearch(): void {
  setTimeout(() => {
    document.querySelector<HTMLInputElement>('[data-search-input]')?.focus()
  }, 60)
}
