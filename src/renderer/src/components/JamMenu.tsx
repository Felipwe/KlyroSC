import { useEffect, useRef, useState, type JSX } from 'react'
import { type JamMember } from '@shared/types/social'
import { t, useLanguage } from '@renderer/i18n'
import { useSocial } from '@renderer/stores/social'
import { useUi } from '@renderer/stores/ui'
import { useNav } from '@renderer/stores/nav'
import { toast } from '@renderer/stores/toasts'
import { cx } from '@renderer/utils/format'
import { Icon } from '@renderer/components/Icon'
import { Switch } from '@renderer/components/controls'
import { useExitAnimation } from '@renderer/hooks/use-exit'
import { SocialAvatar } from '@renderer/pages/SocialPage'

/** Player-bar Jam button: starts a jam, or opens a small management popover when in one. */
export function JamMenuButton(): JSX.Element {
  useLanguage()
  const account = useSocial((state) => state.snapshot.account)
  const jam = useSocial((state) => state.snapshot.jam)
  const jamUnread = useSocial((state) => state.jamUnread)
  const [open, setOpen] = useState(false)
  const { mounted, closing } = useExitAnimation(open, 160)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent): void => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const meId = account?.id ?? ''
  const isOwner = jam !== null && jam.ownerId === meId

  const createJam = async (): Promise<void> => {
    if (!account) {
      setOpen(false)
      toast(t('social.jam.needAccount'))
      useNav.getState().push({ name: 'social' })
      return
    }
    if (busy) return
    setBusy(true)
    await useSocial.getState().createJam()
    setBusy(false)
  }

  const confirmKick = (member: JamMember): void =>
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('social.jam.kick'),
      body: t('social.jam.kickConfirm', { name: member.name }),
      danger: true,
      confirmLabel: t('social.jam.kick'),
      onConfirm: () => void useSocial.getState().kickFromJam(member.id)
    })

  const confirmTransfer = (member: JamMember): void =>
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('social.jam.makeHost'),
      body: t('social.jam.makeHostConfirm', { name: member.name }),
      confirmLabel: t('social.jam.makeHost'),
      onConfirm: () => void useSocial.getState().transferJam(member.id)
    })

  const label = jam ? t('social.jam.manage') : t('social.jam.title')

  return (
    <div className="jam-wrap" ref={wrapRef}>
      <button
        className={cx('icon-btn', jam && 'active', open && 'active')}
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        title={label}
        style={{ position: 'relative' }}
      >
        <Icon name="radio" size={16} />
        {jam && <span className={cx('jam-dot', jamUnread > 0 && 'unread')} />}
      </button>

      {mounted && !jam && (
        <div className={cx('jam-pop', closing && 'closing')} role="dialog" aria-label={t('social.jam.title')}>
          <div className="jam-pop-cta">
            <span className="jam-pop-cta-icon">
              <Icon name="radio" size={17} />
            </span>
            <div className="jam-pop-cta-text">
              <strong>{t('social.jam.title')}</strong>
              <span>{t('social.jam.hint')}</span>
            </div>
          </div>
          <button className="btn primary jam-pop-create" disabled={busy} onClick={() => void createJam()}>
            {busy ? (
              <div className="spinner small" style={{ borderTopColor: '#fff' }} />
            ) : (
              <Icon name="radio" size={14} />
            )}
            {t('social.jam.create')}
          </button>
        </div>
      )}

      {mounted && jam && (
        <div className={cx('jam-pop', closing && 'closing')} role="dialog" aria-label={t('social.jam.manage')}>
          <div className="jam-pop-head">
            <span className="social-live-dot" />
            <span className="jam-pop-title">{t('social.jam.live')}</span>
            <span className="jam-pop-count">
              {t('social.jam.members', { count: jam.members.length })}
            </span>
            {isOwner && (
              <span className="social-host-badge" title={t('social.jam.youAreHost')}>
                <Icon name="crown" size={11} />
              </span>
            )}
          </div>

          <div className="jam-pop-members">
            {jam.members.map((member) => (
              <div key={member.id} className="jam-pop-member">
                <SocialAvatar name={member.name} avatar={member.avatar} size={28} />
                <span className="jam-pop-name" title={member.name}>
                  {member.id === meId ? t('social.you') : member.name}
                </span>
                {member.owner && (
                  <span className="jam-pop-owner" title={t('social.jam.host')}>
                    <Icon name="crown" size={11} />
                  </span>
                )}
                {isOwner && member.id !== meId && (
                  <span className="jam-pop-actions">
                    <button
                      className="icon-btn"
                      title={t('social.jam.makeHost')}
                      aria-label={t('social.jam.makeHost')}
                      onClick={() => confirmTransfer(member)}
                    >
                      <Icon name="crown" size={13} />
                    </button>
                    <button
                      className="icon-btn danger"
                      title={t('social.jam.kick')}
                      aria-label={t('social.jam.kick')}
                      onClick={() => confirmKick(member)}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>

          {jam.queue.length > 0 && (
            <div className="jam-pop-queue">
              <div className="jam-pop-queue-title">{t('social.jam.queueNext')}</div>
              {jam.queue.slice(0, 5).map((track, index) => {
                const adder = track.addedById
                  ? jam.members.find((member) => member.id === track.addedById)
                  : undefined
                const adderName = track.addedByName ?? adder?.name ?? null
                return (
                  <div key={`${track.trackId}-${index}`} className="jam-pop-qrow">
                    <span className="jam-pop-qnum">{index + 1}</span>
                    <div className="jam-pop-qmain">
                      <span className="jam-pop-qtitle" title={track.title}>
                        {track.title}
                      </span>
                      <span className="jam-pop-qartist">{track.artist}</span>
                    </div>
                    {adderName && (
                      <span className="jam-pop-qby" title={t('social.jam.addedBy', { name: adderName })}>
                        <SocialAvatar name={adderName} avatar={adder?.avatar ?? null} size={16} />
                        {adderName.split(' ')[0]}
                      </span>
                    )}
                  </div>
                )
              })}
              {jam.queue.length > 5 && <div className="jam-pop-qmore">+{jam.queue.length - 5}</div>}
            </div>
          )}

          {isOwner && (
            <div className="jam-pop-perm">
              <div className="jam-pop-perm-label">
                {t('social.jam.guestsCanControl')}
                <span>{t('social.jam.guestsCanControlHint')}</span>
              </div>
              <Switch
                on={jam.allowGuestControl}
                onToggle={(on) => void useSocial.getState().setJamControl(on)}
                ariaLabel={t('social.jam.guestsCanControl')}
              />
            </div>
          )}

          <div className="jam-pop-foot">
            <button
              className="btn small"
              onClick={() => {
                useSocial.getState().openJamChat()
                setOpen(false)
              }}
            >
              <Icon name="comment" size={14} />
              {t('social.jam.chatTitle')}
              {jamUnread > 0 && <span className="social-unread">{jamUnread > 9 ? '9+' : jamUnread}</span>}
            </button>
            {isOwner ? (
              <button
                className="btn small danger"
                onClick={() =>
                  useUi.getState().openModal({
                    kind: 'confirm',
                    title: t('social.jam.end'),
                    body: t('social.jam.endConfirm'),
                    danger: true,
                    confirmLabel: t('social.jam.end'),
                    onConfirm: () => void useSocial.getState().endJam()
                  })
                }
              >
                <Icon name="power" size={13} />
                {t('social.jam.end')}
              </button>
            ) : (
              <button className="btn small" onClick={() => void useSocial.getState().leaveJam()}>
                <Icon name="logout" size={13} />
                {t('social.jam.leave')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
