import { useEffect, useLayoutEffect, useRef, useState, type JSX, type PointerEvent } from 'react'
import { type ChatMessage } from '@shared/types/social'
import { avatarHue, initialsOf } from '@shared/utils/social'
import { t, useLanguage } from '@renderer/i18n'
import { clampChatRect, useSocial } from '@renderer/stores/social'
import { cx } from '@renderer/utils/format'
import { Icon } from './Icon'

const NO_MESSAGES: ChatMessage[] = []

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface ChatPanelProps {
  friendId: string
  /** stacking position — last one is on top */
  zIndex: number
}

export function ChatPanel({ friendId, zIndex }: ChatPanelProps): JSX.Element | null {
  useLanguage()
  const friend = useSocial((state) => state.snapshot.friends.find((item) => item.id === friendId) ?? null)
  const messages = useSocial((state) => state.chats[friendId] ?? NO_MESSAGES)
  const loading = useSocial((state) => state.chatLoading[friendId] ?? false)
  // store clears the flag via timeout, so non-zero means "typing right now"
  const typing = useSocial((state) => (state.typing[friendId] ?? 0) > 0)
  const rect = useSocial((state) => state.chatWindows[friendId])
  const [draft, setDraft] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const resizeRef = useRef<{ pointerId: number; startX: number; startY: number; startW: number; startH: number } | null>(
    null
  )

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [messages.length, loading, typing])

  useEffect(() => {
    inputRef.current?.focus()
  }, [friendId])

  if (!friend || !rect) return null

  const hue = avatarHue(friend.name)
  const send = (): void => {
    if (draft.trim().length === 0) return
    void useSocial.getState().sendChat(friendId, draft)
    setDraft('')
    inputRef.current?.focus()
  }

  const focus = (): void => useSocial.getState().focusChat(friendId)

  const onHeadPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest('button')) return
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
  }

  const onHeadPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    useSocial.getState().setChatRect(
      friendId,
      clampChatRect({ ...rect, x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY })
    )
  }

  const onHeadPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  const onResizePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
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
  }

  const onResizePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    useSocial.getState().setChatRect(
      friendId,
      clampChatRect({
        ...rect,
        w: resize.startW + (event.clientX - resize.startX),
        h: resize.startH + (event.clientY - resize.startY)
      })
    )
  }

  const onResizePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null
  }

  return (
    <div
      className="chat-panel glass"
      role="dialog"
      aria-label={`${t('social.chat.title')} — ${friend.name}`}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: 30 + zIndex }}
      onPointerDown={focus}
    >
      <div
        className="chat-head"
        onPointerDown={onHeadPointerDown}
        onPointerMove={onHeadPointerMove}
        onPointerUp={onHeadPointerUp}
        onPointerCancel={onHeadPointerUp}
      >
        <span
          className="social-avatar"
          style={{
            width: 34,
            height: 34,
            fontSize: 12,
            background: friend.avatar
              ? undefined
              : `linear-gradient(135deg, hsl(${hue} 62% 46%), hsl(${(hue + 42) % 360} 68% 34%))`
          }}
        >
          {friend.avatar ? <img src={friend.avatar} alt="" draggable={false} /> : initialsOf(friend.name)}
        </span>
        <div className="chat-head-main">
          <div className="chat-head-name">
            {friend.name}
            <span className="social-id-chip">#{friend.publicId}</span>
          </div>
          <div className={cx('chat-head-sub', friend.presence.online && 'online')}>
            {friend.presence.online ? t('social.online') : t('social.offlineStatus')}
          </div>
        </div>
        <span className="chat-lock" title={t('social.chat.encrypted')}>
          <Icon name="lock" size={13} />
        </span>
        <button
          className="icon-btn"
          onClick={() => useSocial.getState().closeChat(friendId)}
          aria-label={t('common.close')}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {loading ? (
          <div className="chat-empty">
            <div className="spinner small" />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <Icon name="lock" size={20} />
            <span>{t('social.chat.empty')}</span>
            {!friend.presence.online && <span className="chat-note">{t('social.chat.offlineNote')}</span>}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={`${message.id}`}
                className={cx('chat-msg', message.fromMe ? 'mine' : 'theirs', message.pending && 'pending')}
              >
                <div className="chat-bubble">{message.text}</div>
                <div className="chat-meta">{timeOf(message.at)}</div>
              </div>
            ))}
            {typing && (
              <div className="chat-msg theirs">
                <div className="chat-bubble chat-typing" aria-label={t('social.chat.typing', { name: friend.name })}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="chat-compose">
        <input
          ref={inputRef}
          value={draft}
          placeholder={t('social.chat.placeholder')}
          maxLength={2000}
          spellCheck
          onChange={(event) => {
            setDraft(event.currentTarget.value)
            useSocial.getState().notifyTyping(friendId)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            } else if (event.key === 'Escape') {
              useSocial.getState().closeChat(friendId)
            }
          }}
        />
        <button
          className="chat-send"
          onClick={send}
          disabled={draft.trim().length === 0}
          aria-label={t('social.chat.send')}
        >
          <Icon name="send" size={16} />
        </button>
      </div>

      <div
        className="chat-resize"
        aria-hidden="true"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      />
    </div>
  )
}
