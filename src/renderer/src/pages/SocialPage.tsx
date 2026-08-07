import { useEffect, useRef, useState, type JSX, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { type Friend, type PresenceStatus, type UserStats } from '@shared/types/social'
import {
  avatarHue,
  formatAccountNumber,
  initialsOf,
  isValidAccountNumber,
  normalizeAccountNumber,
  parsePublicId
} from '@shared/utils/social'
import { t, useLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { useSocial } from '@renderer/stores/social'
import { useUi } from '@renderer/stores/ui'
import { toast } from '@renderer/stores/toasts'
import { cx } from '@renderer/utils/format'
import { Icon } from '@renderer/components/Icon'
import { Artwork } from '@renderer/components/Artwork'

export function SocialAvatar({
  name,
  avatar = null,
  size = 38
}: {
  name: string
  avatar?: string | null
  size?: number
}): JSX.Element {
  const hue = avatarHue(name)
  return (
    <span
      className="social-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: avatar
          ? 'transparent'
          : `linear-gradient(135deg, hsl(${hue} 62% 46%), hsl(${(hue + 42) % 360} 68% 34%))`
      }}
    >
      {avatar ? <img src={avatar} alt="" draggable={false} /> : initialsOf(name)}
    </span>
  )
}

/** formats the code input as the user types: 1234 5678 9012 3456 */
const formatCodeInput = (raw: string): string =>
  formatAccountNumber(normalizeAccountNumber(raw).slice(0, 16))

//  onboarding 

type OnboardStep = 'intro' | 'code' | 'confirm' | 'login'

function Onboarding(): JSX.Element {
  const busy = useSocial((state) => state.busy)
  const [step, setStep] = useState<OnboardStep>('intro')
  const [account, setAccount] = useState<{ name: string; number: string; publicId: number } | null>(null)
  const [typed, setTyped] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'confirm' || step === 'login') inputRef.current?.focus()
  }, [step])

  const generate = async (): Promise<void> => {
    const created = await useSocial.getState().createAccount()
    if (created) {
      setAccount({
        name: created.user.name,
        number: created.accountNumber,
        publicId: created.user.publicId
      })
      setStep('code')
    }
  }

  const copyCode = async (): Promise<void> => {
    if (!account) return
    await navigator.clipboard.writeText(formatAccountNumber(account.number))
    toast(t('social.codeCopied'), 'success')
  }

  const confirm = async (): Promise<void> => {
    if (!isValidAccountNumber(typed)) {
      setMismatch(true)
      return
    }
    const ok = await useSocial.getState().confirmAccount(typed)
    if (!ok) setMismatch(true)
  }

  const login = async (): Promise<void> => {
    if (!isValidAccountNumber(typed)) return
    await useSocial.getState().login(typed)
  }

  return (
    <div className="social-onboard">
      {step === 'intro' && (
        <div className="social-card social-intro">
          <div className="social-intro-icon">
            <Icon name="users" size={30} />
          </div>
          <h2>{t('social.onboardTitle')}</h2>
          <p>{t('social.onboardBody')}</p>
          <ul className="social-points">
            <li>
              <Icon name="user" size={15} />
              {t('social.onboardPoint1')}
            </li>
            <li>
              <Icon name="keyboard" size={15} />
              {t('social.onboardPoint2')}
            </li>
            <li>
              <Icon name="radio" size={15} />
              {t('social.onboardPoint3')}
            </li>
          </ul>
          <div className="social-actions">
            <button className="btn primary" disabled={busy} onClick={() => void generate()}>
              {busy ? <div className="spinner small" /> : <Icon name="sparkle" size={15} />}
              {t('social.onboardCreate')}
            </button>
            <button
              className="btn"
              onClick={() => {
                setTyped('')
                setStep('login')
              }}
            >
              {t('social.onboardHave')}
            </button>
          </div>
        </div>
      )}

      {step === 'code' && account && (
        <div className="social-card">
          <h2>{t('social.codeTitle')}</h2>
          <p>{t('social.codeBody')}</p>
          <div className="social-identity-preview">
            <SocialAvatar name={account.name} size={44} />
            <div>
              <div className="social-id-label">{t('social.yourName')}</div>
              <div className="social-id-name">
                {account.name} <span className="social-id-chip">#{account.publicId}</span>
              </div>
            </div>
          </div>
          <div className="social-code" role="figure" aria-label={t('social.codeTitle')}>
            {formatAccountNumber(account.number)}
          </div>
          <div className="social-actions">
            <button className="btn" onClick={() => void copyCode()}>
              <Icon name="copy" size={15} />
              {t('social.copyCode')}
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setTyped('')
                setMismatch(false)
                setStep('confirm')
              }}
            >
              {t('social.proceed')}
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="social-card">
          <h2>{t('social.confirmTitle')}</h2>
          <p>{t('social.confirmBody')}</p>
          <input
            ref={inputRef}
            className={cx('social-code-input', mismatch && 'error')}
            value={typed}
            placeholder={t('social.confirmPlaceholder')}
            inputMode="numeric"
            spellCheck={false}
            onChange={(event) => {
              setTyped(formatCodeInput(event.currentTarget.value))
              setMismatch(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void confirm()
            }}
          />
          {mismatch && <div className="social-error">{t('social.confirmMismatch')}</div>}
          <div className="social-actions">
            <button className="btn" onClick={() => setStep('code')}>
              {t('social.back')}
            </button>
            <button
              className="btn primary"
              disabled={busy || normalizeAccountNumber(typed).length !== 16}
              onClick={() => void confirm()}
            >
              {busy ? <div className="spinner small" /> : <Icon name="check" size={15} />}
              {t('social.confirm')}
            </button>
          </div>
        </div>
      )}

      {step === 'login' && (
        <div className="social-card">
          <h2>{t('social.loginTitle')}</h2>
          <p>{t('social.loginBody')}</p>
          <input
            ref={inputRef}
            className="social-code-input"
            value={typed}
            placeholder={t('social.confirmPlaceholder')}
            inputMode="numeric"
            spellCheck={false}
            onChange={(event) => setTyped(formatCodeInput(event.currentTarget.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void login()
            }}
          />
          <div className="social-actions">
            <button className="btn" onClick={() => setStep('intro')}>
              {t('social.back')}
            </button>
            <button
              className="btn primary"
              disabled={busy || normalizeAccountNumber(typed).length !== 16}
              onClick={() => void login()}
            >
              {busy ? <div className="spinner small" /> : <Icon name="logout" size={15} />}
              {t('social.loginAction')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

//  jam 

function statusOf(friend: Friend): 'offline' | PresenceStatus {
  return friend.presence.online ? friend.presence.status : 'offline'
}

function statusLabel(status: 'offline' | PresenceStatus): string {
  return status === 'offline' ? t('social.offlineStatus') : t(`social.status.${status}`)
}

function formatListeningTime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0
    ? t('social.profile.hoursShort', { hours, minutes })
    : t('social.profile.minutesShort', { minutes })
}

/** Listening time + most repeated track, shared by my profile and friend profiles. */
function StatsCards({ stats }: { stats: UserStats | null }): JSX.Element {
  return (
    <div className="sp-stats">
      <div className="sp-stat">
        <span className="sp-stat-icon">
          <Icon name="clock" size={16} />
        </span>
        <div className="sp-stat-main">
          <span className="sp-stat-label">{t('social.profile.listeningTime')}</span>
          <strong>{stats ? formatListeningTime(stats.listeningMs) : '—'}</strong>
        </div>
      </div>
      <div className="sp-stat">
        {stats?.topTrack ? (
          <>
            <Artwork src={stats.topTrack.artwork} alt="" />
            <div className="sp-stat-main">
              <span className="sp-stat-label">{t('social.profile.topTrack')}</span>
              <strong className="sp-stat-track" title={stats.topTrack.title}>
                {stats.topTrack.title}
              </strong>
              <span className="sp-stat-sub">
                {stats.topTrack.artist} · {t('social.profile.plays', { count: stats.topTrack.plays })}
              </span>
            </div>
          </>
        ) : (
          <>
            <span className="sp-stat-icon">
              <Icon name="music" size={16} />
            </span>
            <div className="sp-stat-main">
              <span className="sp-stat-label">{t('social.profile.topTrack')}</span>
              <strong>{t('social.profile.noStats')}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ProfileTab(): JSX.Element {
  const account = useSocial((state) => state.snapshot.account)!
  const myStatus = useSocial((state) => state.snapshot.myStatus)
  const [stats, setStats] = useState<UserStats | null>(null)

  useEffect(() => {
    void api.social.myStats().then(setStats)
  }, [])

  const copyId = async (): Promise<void> => {
    await navigator.clipboard.writeText(`#${account.publicId}`)
    toast(t('social.idCopied'), 'success')
  }

  const rename = (): void =>
    useUi.getState().openModal({
      kind: 'prompt',
      title: t('social.renameTitle'),
      placeholder: t('social.renamePlaceholder'),
      initialValue: account.name,
      confirmLabel: t('common.save'),
      onConfirm: (name) => {
        if (name && name.trim() !== account.name) void useSocial.getState().rename(name)
      }
    })

  const openAvatarMenu = (event: MouseEvent): void => {
    const items = [
      {
        id: 'avatar-change',
        label: t('social.avatarChange'),
        icon: 'edit',
        action: () => void useSocial.getState().setAvatar()
      },
      ...(account.avatar
        ? [
            {
              id: 'avatar-remove',
              label: t('social.avatarRemove'),
              icon: 'trash',
              danger: true,
              action: () => void useSocial.getState().removeAvatar()
            }
          ]
        : [])
    ]
    const rect = event.currentTarget.getBoundingClientRect()
    useUi.getState().openMenu(rect.left, rect.bottom + 6, items)
  }

  const logout = (): void =>
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('social.logoutSocial'),
      body: t('social.loggedOut'),
      confirmLabel: t('social.logoutSocial'),
      onConfirm: () => void useSocial.getState().logout()
    })

  const deleteAccount = (): void =>
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('social.deleteAccount'),
      body: t('social.deleteConfirm'),
      danger: true,
      confirmLabel: t('social.deleteAccount'),
      onConfirm: () => void useSocial.getState().deleteAccount()
    })

  return (
    <>
      <div className="social-card social-profile">
        <button
          className="social-avatar-btn big"
          onClick={openAvatarMenu}
          title={t('social.avatarChange')}
          aria-label={t('social.avatarChange')}
        >
          <SocialAvatar name={account.name} avatar={account.avatar} size={76} />
          <span className="social-avatar-edit">
            <Icon name="edit" size={13} />
          </span>
        </button>
        <div className="sp-identity">
          <div className="social-me-name">
            {account.name}
            <button
              className="icon-btn social-rename-btn"
              onClick={rename}
              title={t('social.renameTitle')}
              aria-label={t('social.renameTitle')}
            >
              <Icon name="edit" size={12} />
            </button>
            <button className="social-id-chip clickable" onClick={() => void copyId()} title={t('social.idCopied')}>
              #{account.publicId}
              <Icon name="copy" size={11} />
            </button>
          </div>
          <div className="sp-status-row" role="radiogroup" aria-label={t('social.statusTitle')}>
            {(['online', 'away', 'dnd'] as PresenceStatus[]).map((status) => (
              <button
                key={status}
                className={cx('sp-status-pill', status, myStatus === status && 'active')}
                role="radio"
                aria-checked={myStatus === status}
                onClick={() => useSocial.getState().setStatus(status)}
              >
                <span className={cx('social-status-dot inline', status)} />
                {t(`social.status.${status}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="social-section">
        <h3 className="social-section-title">{t('social.profile.statsTitle')}</h3>
        <StatsCards stats={stats} />
      </section>

      <section className="social-section">
        <h3 className="social-section-title">{t('social.account')}</h3>
        <div className="sp-account-actions">
          <button className="btn" onClick={logout}>
            <Icon name="logout" size={14} />
            {t('social.logoutSocial')}
          </button>
          <button className="btn danger" onClick={deleteAccount}>
            <Icon name="trash" size={14} />
            {t('social.deleteAccount')}
          </button>
        </div>
      </section>
    </>
  )
}

/** Discord-style profile card for a friend, opened from the friends list. */
function FriendProfileModal({ friendId, onClose }: { friendId: string; onClose: () => void }): JSX.Element | null {
  const friend = useSocial((state) => state.snapshot.friends.find((item) => item.id === friendId) ?? null)
  const jam = useSocial((state) => state.snapshot.jam)
  const [closing, setClosing] = useState(false)

  // animate out, then actually unmount
  const close = (): void => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 170)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close is stable enough for a keydown guard
  }, [closing])

  if (!friend) return null
  const status = statusOf(friend)
  const listening = friend.presence.listening
  const canInvite =
    jam !== null && friend.presence.online && !jam.members.some((member) => member.id === friend.id)

  const removeFriend = (): void =>
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('social.removeFriend'),
      body: t('social.removeFriendConfirm', { name: friend.name }),
      danger: true,
      confirmLabel: t('social.removeFriend'),
      onConfirm: () => {
        close()
        void useSocial.getState().removeFriend(friend.id)
      }
    })

  return createPortal(
    <div
      className={cx('scrim fp-scrim', closing && 'closing')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="modal glass friend-profile" role="dialog" aria-modal="true" aria-label={friend.name}>
        <div className="fp-head">
          <div className="social-friend-avatar big">
            <SocialAvatar name={friend.name} avatar={friend.avatar} size={72} />
            <span className={cx('social-status-dot', status !== 'offline' && status)} />
          </div>
          <div className="fp-id">
            <h3>
              {friend.name} <span className="social-id-chip">#{friend.publicId}</span>
            </h3>
            <div className={cx('fp-status', status)}>{statusLabel(status)}</div>
            <div className="fp-since">
              {t('social.profile.friendSince', { date: new Date(friend.since).toLocaleDateString() })}
            </div>
          </div>
          <button className="icon-btn fp-close" onClick={close} aria-label={t('common.close')}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {listening && (
          <div className="fp-listening">
            <Artwork src={listening.artwork} alt="" />
            <div className="fp-listening-main">
              <span className="sp-stat-label">{t('social.listeningNow')}</span>
              <strong title={listening.title}>{listening.title}</strong>
              <span className="sp-stat-sub">{listening.artist}</span>
            </div>
            <span className={cx('eq mini', !listening.playing && 'paused')} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}

        <StatsCards stats={friend.stats} />

        <div className="fp-actions">
          <button
            className="btn primary"
            onClick={() => {
              close()
              void useSocial.getState().openChat(friend.id)
            }}
          >
            <Icon name="comment" size={14} />
            {t('social.profile.message')}
          </button>
          {canInvite && (
            <button className="btn" onClick={() => void useSocial.getState().inviteToJam(friend.id)}>
              <Icon name="radio" size={14} />
              {t('social.jam.invite')}
            </button>
          )}
          <button className="btn danger" onClick={removeFriend}>
            <Icon name="trash" size={14} />
            {t('social.removeFriend')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

//  hub 

function FriendRow({
  friend,
  inJam,
  onProfile
}: {
  friend: Friend
  inJam: boolean
  onProfile: (id: string) => void
}): JSX.Element {
  const { presence } = friend
  const unread = useSocial((state) => state.unread[friend.id] ?? 0)
  // store clears the flag via timeout, so non-zero means "typing right now"
  const typing = useSocial((state) => (state.typing[friend.id] ?? 0) > 0)
  const status = statusOf(friend)

  return (
    <div
      className="social-friend-row"
      role="button"
      tabIndex={0}
      title={t('social.profile.view')}
      onClick={() => onProfile(friend.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onProfile(friend.id)
      }}
    >
      <div className="social-friend-avatar">
        <SocialAvatar name={friend.name} avatar={friend.avatar} />
        <span className={cx('social-status-dot', status !== 'offline' && status)} />
      </div>
      <div className="social-friend-main">
        <div className="social-friend-name">
          {friend.name}
          <span className="social-id-chip">#{friend.publicId}</span>
        </div>
        <div className="social-friend-sub">
          {typing ? (
            <span className="social-typing-text">
              {t('social.chat.typing', { name: friend.name.split(' ')[0] ?? '' })}
            </span>
          ) : presence.online && presence.listening ? (
            <>
              <span className={cx('eq mini', !presence.listening.playing && 'paused')} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="social-listening-text">
                {presence.listening.title} · {presence.listening.artist}
              </span>
            </>
          ) : (
            <span className={cx(status !== 'offline' && 'social-online-text', `st-${status}`)}>
              {statusLabel(status)}
            </span>
          )}
        </div>
      </div>
      <div className="social-friend-actions">
        {inJam && presence.online && (
          <button
            className="icon-btn"
            title={t('social.jam.invite')}
            aria-label={t('social.jam.invite')}
            onClick={(event) => {
              event.stopPropagation()
              void useSocial.getState().inviteToJam(friend.id)
            }}
          >
            <Icon name="radio" size={16} />
          </button>
        )}
        <button
          className="icon-btn"
          title={t('social.profile.view')}
          aria-label={t('social.profile.view')}
          onClick={(event) => {
            event.stopPropagation()
            onProfile(friend.id)
          }}
        >
          <Icon name="user" size={15} />
        </button>
      </div>
      <div
        className="social-chat-open"
        role="button"
        tabIndex={0}
        title={t('social.chat.open')}
        aria-label={t('social.chat.open')}
        onClick={(event) => {
          event.stopPropagation()
          void useSocial.getState().openChat(friend.id)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.stopPropagation()
            void useSocial.getState().openChat(friend.id)
          }
        }}
      >
        <Icon name="comment" size={16} />
        {unread > 0 && <span className="social-unread">{unread > 9 ? '9+' : unread}</span>}
      </div>
    </div>
  )
}

function Hub(): JSX.Element {
  const snapshot = useSocial((state) => state.snapshot)
  const [tab, setTab] = useState<'friends' | 'profile'>('friends')
  const [profileFriendId, setProfileFriendId] = useState<string | null>(null)
  const [friendId, setFriendId] = useState('')
  const incoming = snapshot.requests.filter((request) => request.direction === 'in')
  const outgoing = snapshot.requests.filter((request) => request.direction === 'out')

  const addFriend = async (): Promise<void> => {
    const publicId = parsePublicId(friendId)
    if (publicId === null) {
      toast(t('social.errors.invalid_id'), 'error')
      return
    }
    const ok = await useSocial.getState().addFriend(publicId)
    if (ok) setFriendId('')
  }

  return (
    <>
      {!snapshot.connected && (
        <div className="social-offline-banner">
          <Icon name="alert" size={15} />
          {t('social.offline')}
          <button className="btn small" onClick={() => api.social.reconnect()}>
            {t('social.retry')}
          </button>
        </div>
      )}

      {snapshot.invites.map((invite) => (
        <div key={invite.id} className="social-card social-invite-banner">
          <SocialAvatar name={invite.from.name} avatar={invite.from.avatar} size={34} />
          <div className="social-invite-text">{t('social.jam.inviteFrom', { name: invite.from.name })}</div>
          <div className="social-invite-actions">
            <button
              className="btn small primary"
              onClick={() => void useSocial.getState().respondInvite(invite.id, true)}
            >
              {t('social.jam.join')}
            </button>
            <button className="btn small" onClick={() => void useSocial.getState().respondInvite(invite.id, false)}>
              {t('social.decline')}
            </button>
          </div>
        </div>
      ))}

      <div className="tabs social-tabs">
        <button className={cx(tab === 'friends' && 'active')} onClick={() => setTab('friends')}>
          <Icon name="users" size={14} />
          {t('social.tabs.friends')}
          {incoming.length > 0 && <span className="social-unread">{incoming.length}</span>}
        </button>
        <button className={cx(tab === 'profile' && 'active')} onClick={() => setTab('profile')}>
          <Icon name="user" size={14} />
          {t('social.tabs.profile')}
        </button>
      </div>

      {tab === 'profile' ? (
        <ProfileTab />
      ) : (
        <>
          {incoming.length + outgoing.length > 0 && (
            <section className="social-section">
              <h3 className="social-section-title">{t('social.requests')}</h3>
              {incoming.map((request) => (
                <div key={request.id} className="social-request-row">
                  <SocialAvatar name={request.user.name} avatar={request.user.avatar} size={32} />
                  <div className="social-request-text">
                    <strong>{request.user.name}</strong>{' '}
                    <span className="social-id-chip">#{request.user.publicId}</span> {t('social.incoming')}
                  </div>
                  <div className="social-invite-actions">
                    <button
                      className="btn small primary"
                      onClick={() => void useSocial.getState().respondRequest(request.id, true)}
                    >
                      {t('social.accept')}
                    </button>
                    <button
                      className="btn small"
                      onClick={() => void useSocial.getState().respondRequest(request.id, false)}
                    >
                      {t('social.decline')}
                    </button>
                  </div>
                </div>
              ))}
              {outgoing.map((request) => (
                <div key={request.id} className="social-request-row muted">
                  <SocialAvatar name={request.user.name} avatar={request.user.avatar} size={32} />
                  <div className="social-request-text">{t('social.outgoing', { name: request.user.name })}</div>
                  <button
                    className="btn small"
                    onClick={() => void useSocial.getState().respondRequest(request.id, false)}
                  >
                    {t('social.cancelRequest')}
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="social-section">
            <div className="social-friends-head">
              <h3 className="social-section-title">{t('social.friends')}</h3>
              <div className="social-add-friend">
                <div className="social-add-input">
                  <Icon name="userPlus" size={15} />
                  <input
                    value={friendId}
                    placeholder={t('social.addFriendPlaceholder')}
                    spellCheck={false}
                    onChange={(event) => setFriendId(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void addFriend()
                    }}
                  />
                </div>
                <button
                  className="btn small"
                  disabled={parsePublicId(friendId) === null}
                  onClick={() => void addFriend()}
                >
                  {t('social.add')}
                </button>
              </div>
            </div>
            <div className="social-add-hint">{t('social.addFriendHint')}</div>

            {snapshot.friends.length === 0 ? (
              <div className="social-empty">
                <Icon name="users" size={26} />
                <div>{t('social.noFriends')}</div>
                <span>{t('social.noFriendsHint')}</span>
              </div>
            ) : (
              <div className="social-friends-list">
                {[...snapshot.friends]
                  .sort(
                    (a, b) =>
                      Number(b.presence.online) - Number(a.presence.online) || a.name.localeCompare(b.name)
                  )
                  .map((friend) => (
                    <FriendRow
                      key={friend.id}
                      friend={friend}
                      inJam={snapshot.jam !== null}
                      onProfile={setProfileFriendId}
                    />
                  ))}
              </div>
            )}
          </section>
        </>
      )}

      {profileFriendId && (
        <FriendProfileModal friendId={profileFriendId} onClose={() => setProfileFriendId(null)} />
      )}
    </>
  )
}

export function SocialPage(): JSX.Element {
  useLanguage()
  const account = useSocial((state) => state.snapshot.account)

  return (
    <div className="page social-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('social.title')}</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {t('social.subtitle')}
          </p>
        </div>
      </div>
      {account ? <Hub /> : <Onboarding />}
    </div>
  )
}
