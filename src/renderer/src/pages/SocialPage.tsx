import { useEffect, useRef, useState, type JSX, type MouseEvent } from 'react'
import { type Friend, type JamState, JAM_MAX_MEMBERS } from '@shared/types/social'
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
import { Switch } from '@renderer/components/controls'
import { ChatPanel } from '@renderer/components/ChatPanel'

export function SocialAvatar({ name, size = 38 }: { name: string; size?: number }): JSX.Element {
  const hue = avatarHue(name)
  return (
    <span
      className="social-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 62% 46%), hsl(${(hue + 42) % 360} 68% 34%))`
      }}
    >
      {initialsOf(name)}
    </span>
  )
}

/** formats the code input as the user types: 1234 5678 9012 3456 */
const formatCodeInput = (raw: string): string =>
  formatAccountNumber(normalizeAccountNumber(raw).slice(0, 16))

// ————————————————————— onboarding —————————————————————

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

// ————————————————————— jam —————————————————————

function JamCard({ jam, meId, friends }: { jam: JamState; meId: string; friends: Friend[] }): JSX.Element {
  const [inviteOpen, setInviteOpen] = useState(false)
  const isOwner = jam.ownerId === meId
  const playback = jam.playback
  const onlineFriends = friends.filter(
    (friend) => friend.presence.online && !jam.members.some((member) => member.id === friend.id)
  )

  const endJam = (): void =>
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('social.jam.end'),
      body: t('social.jam.endConfirm'),
      danger: true,
      confirmLabel: t('social.jam.end'),
      onConfirm: () => void useSocial.getState().endJam()
    })

  return (
    <div className="social-card social-jam-live">
      <div className="social-jam-head">
        <span className="social-live-dot" />
        <span className="social-jam-name">{t('social.jam.live')}</span>
        <span className="social-jam-count">{t('social.jam.members', { count: jam.members.length })}</span>
        {isOwner && (
          <span className="social-host-badge" title={t('social.jam.youAreHost')}>
            <Icon name="crown" size={12} />
          </span>
        )}
        <div className="social-jam-head-actions">
          {isOwner ? (
            <button className="btn small danger" onClick={endJam}>
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

      <div className="social-jam-body">
        <div className="social-member-stack" title={jam.members.map((member) => member.name).join(', ')}>
          {jam.members.map((member) => (
            <span key={member.id} className="social-stack-item">
              <SocialAvatar name={member.name} size={30} />
              {member.owner && (
                <span className="social-crown">
                  <Icon name="crown" size={9} />
                </span>
              )}
            </span>
          ))}
          {jam.members.length < JAM_MAX_MEMBERS && (
            <button
              className="social-stack-add"
              onClick={() => setInviteOpen((open) => !open)}
              title={t('social.jam.invite')}
              aria-label={t('social.jam.invite')}
            >
              <Icon name="userPlus" size={14} />
            </button>
          )}
        </div>

        <div className="social-jam-now">
          {playback.track ? (
            <>
              <Artwork src={playback.track.artwork} alt="" />
              <div className="social-jam-track">
                <div className="social-jam-track-title">{playback.track.title}</div>
                <div className="social-jam-track-artist">{playback.track.artist}</div>
              </div>
              <div className={cx('eq mini', !playback.playing && 'paused')} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </>
          ) : (
            <div className="social-muted">{t('social.jam.nothingPlaying')}</div>
          )}
        </div>
      </div>

      {inviteOpen && (
        <div className="social-invite-list">
          {onlineFriends.length === 0 ? (
            <div className="social-muted">{t('social.jam.noOneToInvite')}</div>
          ) : (
            onlineFriends.map((friend) => (
              <button
                key={friend.id}
                className="social-invite-row"
                onClick={() => {
                  void useSocial.getState().inviteToJam(friend.id)
                  setInviteOpen(false)
                }}
              >
                <SocialAvatar name={friend.name} size={26} />
                <span>{friend.name}</span>
                <span className="social-id-chip">#{friend.publicId}</span>
                <Icon name="plus" size={14} />
              </button>
            ))
          )}
        </div>
      )}

      {jam.queue.length > 0 && (
        <div className="social-jam-queue">
          {jam.queue.slice(0, 3).map((track, index) => (
            <div key={`${track.trackId}-${index}`} className="social-jam-queue-row">
              <span className="social-queue-num">{index + 1}</span>
              <span className="social-queue-title">{track.title}</span>
              <span className="social-queue-artist">{track.artist}</span>
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="social-jam-footer">
          <div className="social-toggle-label">
            {t('social.jam.guestsCanControl')}
            <span className="social-toggle-hint">{t('social.jam.guestsCanControlHint')}</span>
          </div>
          <Switch
            on={jam.allowGuestControl}
            onToggle={(on) => void useSocial.getState().setJamControl(on)}
            ariaLabel={t('social.jam.guestsCanControl')}
          />
        </div>
      )}
    </div>
  )
}

// ————————————————————— hub —————————————————————

function FriendRow({ friend, inJam }: { friend: Friend; inJam: boolean }): JSX.Element {
  const { presence } = friend
  const unread = useSocial((state) => state.unread[friend.id] ?? 0)
  // store clears the flag via timeout, so non-zero means "typing right now"
  const typing = useSocial((state) => (state.typing[friend.id] ?? 0) > 0)

  const remove = (event: MouseEvent): void => {
    event.stopPropagation()
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('social.removeFriend'),
      body: t('social.removeFriendConfirm', { name: friend.name }),
      danger: true,
      confirmLabel: t('social.removeFriend'),
      onConfirm: () => void useSocial.getState().removeFriend(friend.id)
    })
  }

  return (
    <div
      className="social-friend-row"
      role="button"
      tabIndex={0}
      onClick={() => void useSocial.getState().openChat(friend.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') void useSocial.getState().openChat(friend.id)
      }}
    >
      <div className="social-friend-avatar">
        <SocialAvatar name={friend.name} />
        <span className={cx('social-status-dot', presence.online && 'online')} />
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
          ) : presence.online ? (
            presence.listening ? (
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
              <span className="social-online-text">{t('social.online')}</span>
            )
          ) : (
            <span>{t('social.offlineStatus')}</span>
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
          title={t('social.removeFriend')}
          aria-label={t('social.removeFriend')}
          onClick={remove}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>
      <div className="social-chat-open" aria-hidden="true">
        <Icon name="comment" size={16} />
        {unread > 0 && <span className="social-unread">{unread > 9 ? '9+' : unread}</span>}
      </div>
    </div>
  )
}

function Hub(): JSX.Element {
  const snapshot = useSocial((state) => state.snapshot)
  const [friendId, setFriendId] = useState('')
  const account = snapshot.account!
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

  const copyId = async (): Promise<void> => {
    await navigator.clipboard.writeText(`#${account.publicId}`)
    toast(t('social.idCopied'), 'success')
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
      <div className="social-header social-card">
        <div className="social-me">
          <SocialAvatar name={account.name} size={44} />
          <div>
            <div className="social-me-name">
              {account.name}
              <button className="social-id-chip clickable" onClick={() => void copyId()} title={t('social.idCopied')}>
                #{account.publicId}
                <Icon name="copy" size={11} />
              </button>
            </div>
            <div className="social-me-sub">
              <span className={cx('social-status-dot inline', snapshot.connected && 'online')} />
              {snapshot.connected ? t('social.online') : t('social.connecting')}
            </div>
          </div>
        </div>
        <div className="social-header-actions">
          <button
            className="icon-btn"
            title={t('social.logoutSocial')}
            aria-label={t('social.logoutSocial')}
            onClick={logout}
          >
            <Icon name="logout" size={16} />
          </button>
          <button
            className="icon-btn"
            title={t('social.deleteAccount')}
            aria-label={t('social.deleteAccount')}
            onClick={deleteAccount}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

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
          <SocialAvatar name={invite.from.name} size={34} />
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

      {snapshot.jam ? (
        <JamCard jam={snapshot.jam} meId={account.id} friends={snapshot.friends} />
      ) : (
        <div className="social-card social-jam-cta">
          <div className="social-jam-cta-icon">
            <Icon name="radio" size={22} />
          </div>
          <div className="social-jam-cta-main">
            <h3>{t('social.jam.title')}</h3>
            <p>{t('social.jam.hint')}</p>
          </div>
          <button className="btn primary" onClick={() => void useSocial.getState().createJam()}>
            <Icon name="radio" size={15} />
            {t('social.jam.create')}
          </button>
        </div>
      )}

      {incoming.length + outgoing.length > 0 && (
        <section className="social-section">
          <h3 className="social-section-title">{t('social.requests')}</h3>
          {incoming.map((request) => (
            <div key={request.id} className="social-request-row">
              <SocialAvatar name={request.user.name} size={32} />
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
              <SocialAvatar name={request.user.name} size={32} />
              <div className="social-request-text">{t('social.outgoing', { name: request.user.name })}</div>
              <button className="btn small" onClick={() => void useSocial.getState().respondRequest(request.id, false)}>
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
            <button className="btn small" disabled={parsePublicId(friendId) === null} onClick={() => void addFriend()}>
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
              .sort((a, b) => Number(b.presence.online) - Number(a.presence.online) || a.name.localeCompare(b.name))
              .map((friend) => (
                <FriendRow key={friend.id} friend={friend} inJam={snapshot.jam !== null} />
              ))}
          </div>
        )}
      </section>

      <ChatPanel />
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
