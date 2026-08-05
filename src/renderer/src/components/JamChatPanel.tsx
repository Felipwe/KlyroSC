import { useLayoutEffect, useRef, useState, type JSX } from 'react'
import { avatarHue } from '@shared/utils/social'
import { t, useLanguage } from '@renderer/i18n'
import { JAM_CHAT_KEY, useSocial } from '@renderer/stores/social'
import { useFloatingWindow } from '@renderer/hooks/floating-window'
import { cx } from '@renderer/utils/format'
import { Icon } from './Icon'

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Group chat for the whole jam — every member can talk. */
export function JamChatPanel({ zIndex }: { zIndex: number }): JSX.Element | null {
  useLanguage()
  const jam = useSocial((state) => state.snapshot.jam)
  const meId = useSocial((state) => state.snapshot.account?.id ?? '')
  const { rect, focus, headHandlers, resizeHandlers } = useFloatingWindow(JAM_CHAT_KEY)
  const [draft, setDraft] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messageCount = jam?.chat.length ?? 0

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [messageCount])

  if (!jam || !rect) return null

  const send = (): void => {
    if (draft.trim().length === 0) return
    useSocial.getState().sendJamChat(draft)
    setDraft('')
    inputRef.current?.focus()
  }

  return (
    <div
      className="chat-panel glass"
      role="dialog"
      aria-label={t('social.jam.chatTitle')}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: 30 + zIndex }}
      onPointerDown={focus}
    >
      <div className="chat-head" {...headHandlers}>
        <span className="social-jam-cta-icon" style={{ width: 34, height: 34, borderRadius: 11 }}>
          <Icon name="radio" size={16} />
        </span>
        <div className="chat-head-main">
          <div className="chat-head-name">{t('social.jam.chatTitle')}</div>
          <div className="chat-head-sub online">
            {t('social.jam.members', { count: jam.members.length })}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={() => useSocial.getState().closeChat(JAM_CHAT_KEY)}
          aria-label={t('common.close')}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {jam.chat.length === 0 ? (
          <div className="chat-empty">
            <Icon name="radio" size={20} />
            <span>{t('social.jam.chatEmpty')}</span>
          </div>
        ) : (
          jam.chat.map((message) => {
            const mine = message.fromId === meId
            return (
              <div key={message.id} className={cx('chat-msg', mine ? 'mine' : 'theirs')}>
                {!mine && (
                  <div
                    className="chat-sender"
                    style={{ color: `hsl(${avatarHue(message.fromName)} 70% 68%)` }}
                  >
                    {message.fromName}
                  </div>
                )}
                <div className="chat-bubble">{message.text}</div>
                <div className="chat-meta">{timeOf(message.at)}</div>
              </div>
            )
          })
        )}
      </div>

      <div className="chat-compose">
        <input
          ref={inputRef}
          value={draft}
          placeholder={t('social.chat.placeholder')}
          maxLength={500}
          spellCheck
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            } else if (event.key === 'Escape') {
              useSocial.getState().closeChat(JAM_CHAT_KEY)
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

      <div className="chat-resize" aria-hidden="true" {...resizeHandlers} />
    </div>
  )
}
