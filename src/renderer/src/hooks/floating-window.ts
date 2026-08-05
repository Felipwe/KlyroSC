import { useRef, type PointerEvent } from 'react'
import { clampChatRect, useSocial, type ChatWindowRect } from '@renderer/stores/social'

interface PointerHandlers {
  onPointerDown(event: PointerEvent<HTMLDivElement>): void
  onPointerMove(event: PointerEvent<HTMLDivElement>): void
  onPointerUp(event: PointerEvent<HTMLDivElement>): void
  onPointerCancel(event: PointerEvent<HTMLDivElement>): void
}

/** Drag (header) + resize (corner) plumbing for floating chat windows. */
export function useFloatingWindow(windowKey: string): {
  rect: ChatWindowRect | undefined
  focus(): void
  headHandlers: PointerHandlers
  resizeHandlers: PointerHandlers
} {
  const rect = useSocial((state) => state.chatWindows[windowKey])
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const resizeRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  const focus = (): void => useSocial.getState().focusChat(windowKey)

  const headHandlers: PointerHandlers = {
    onPointerDown: (event) => {
      if (!rect || (event.target as HTMLElement).closest('button')) return
      dragRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.x,
        offsetY: event.clientY - rect.y
      }
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* synthetic events have no active pointer */
      }
    },
    onPointerMove: (event) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId || !rect) return
      useSocial.getState().setChatRect(
        windowKey,
        clampChatRect({ ...rect, x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY })
      )
    },
    onPointerUp: (event) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    },
    onPointerCancel: (event) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    }
  }

  const resizeHandlers: PointerHandlers = {
    onPointerDown: (event) => {
      if (!rect) return
      event.stopPropagation()
      resizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startW: rect.w,
        startH: rect.h
      }
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* synthetic events have no active pointer */
      }
    },
    onPointerMove: (event) => {
      const resize = resizeRef.current
      if (!resize || resize.pointerId !== event.pointerId || !rect) return
      useSocial.getState().setChatRect(
        windowKey,
        clampChatRect({
          ...rect,
          w: resize.startW + (event.clientX - resize.startX),
          h: resize.startH + (event.clientY - resize.startY)
        })
      )
    },
    onPointerUp: (event) => {
      if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null
    },
    onPointerCancel: (event) => {
      if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null
    }
  }

  return { rect, focus, headHandlers, resizeHandlers }
}
