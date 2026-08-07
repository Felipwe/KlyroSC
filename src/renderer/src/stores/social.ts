import { create } from 'zustand'
import {
  EMPTY_SOCIAL,
  type ChatMessage,
  type NewSocialAccount,
  type PresenceStatus,
  type SocialSnapshot
} from '@shared/types/social'
import { api } from '@renderer/services/ipc'
import { t } from '@renderer/i18n'
import { toast } from '@renderer/stores/toasts'

/** Maps server/service error codes to localized messages. */
export function socialError(code: string): string {
  const known = new Set([
    'network',
    'rate_limited',
    'invalid_account',
    'invalid_id',
    'invalid_message',
    'invalid_name',
    'name_taken',
    'no_chat_key',
    'user_not_found',
    'cannot_add_self',
    'already_friends',
    'already_requested',
    'friend_offline',
    'not_friends',
    'jam_full',
    'already_invited',
    'already_member',
    'not_in_jam',
    'not_member',
    'owner_only',
    'invite_not_found',
    'jam_gone',
    'code_mismatch',
    'unauthorized'
  ])
  if (known.has(code)) return t(`social.errors.${code}`)
  return t('social.errors.generic')
}

const TYPING_TTL = 3_500
let tempCounter = 0

/** reserved key so the jam group chat shares the floating-window machinery */
export const JAM_CHAT_KEY = '~jam'

export interface ChatWindowRect {
  x: number
  y: number
  w: number
  h: number
}

const CHAT_MIN_W = 280
const CHAT_MIN_H = 320

export const clampChatRect = (rect: ChatWindowRect): ChatWindowRect => {
  const maxW = Math.max(CHAT_MIN_W, window.innerWidth - 24)
  const maxH = Math.max(CHAT_MIN_H, window.innerHeight - 70)
  const w = Math.min(Math.max(rect.w, CHAT_MIN_W), maxW)
  const h = Math.min(Math.max(rect.h, CHAT_MIN_H), maxH)
  return {
    w,
    h,
    x: Math.min(Math.max(rect.x, 8 - w + 60), window.innerWidth - 60),
    y: Math.min(Math.max(rect.y, 48), window.innerHeight - 60)
  }
}

/** opens centered in front of the app, cascading down-right per open window */
const defaultChatRect = (index: number): ChatWindowRect => {
  const w = 330
  const h = Math.min(480, Math.max(CHAT_MIN_H, window.innerHeight - 220))
  return clampChatRect({
    x: Math.round((window.innerWidth - w) / 2) + index * 44,
    y: Math.round(Math.max(60, (window.innerHeight - h) / 2 - 24)) + index * 26,
    w,
    h
  })
}

// light client-side antispam: 6 messages per 5s window
const chatSendTimes: number[] = []
const chatSendAllowed = (): boolean => {
  const now = Date.now()
  while (chatSendTimes.length > 0 && now - (chatSendTimes[0] ?? 0) > 5_000) chatSendTimes.shift()
  if (chatSendTimes.length >= 6) return false
  chatSendTimes.push(now)
  return true
}

interface SocialStore {
  snapshot: SocialSnapshot
  loaded: boolean
  busy: boolean
  /** friendId → loaded message window (oldest→newest) */
  chats: Record<string, ChatMessage[]>
  /** open chat windows; array order = stacking order (last on top) */
  openChats: string[]
  chatWindows: Record<string, ChatWindowRect>
  chatLoading: Record<string, boolean>
  /** chat windows playing their exit animation */
  closingChats: Record<string, boolean>
  unread: Record<string, number>
  /** friendId → epoch ms when the typing hint expires */
  typing: Record<string, number>
  load(): Promise<void>
  createAccount(): Promise<NewSocialAccount | null>
  confirmAccount(code: string): Promise<boolean>
  login(code: string): Promise<boolean>
  logout(): Promise<void>
  deleteAccount(): Promise<boolean>
  addFriend(publicId: number): Promise<boolean>
  respondRequest(id: string, accept: boolean): Promise<void>
  removeFriend(userId: string): Promise<void>
  createJam(): Promise<void>
  inviteToJam(userId: string): Promise<boolean>
  respondInvite(id: string, accept: boolean): Promise<void>
  leaveJam(): Promise<void>
  endJam(): Promise<void>
  setJamControl(allow: boolean): Promise<void>
  kickFromJam(userId: string): Promise<void>
  transferJam(userId: string): Promise<void>
  openChat(friendId: string): Promise<void>
  openJamChat(): void
  closeChat(friendId: string): void
  focusChat(friendId: string): void
  setChatRect(friendId: string, rect: ChatWindowRect): void
  sendChat(friendId: string, text: string): Promise<void>
  sendJamChat(text: string): void
  notifyTyping(friendId: string): void
  setAvatar(): Promise<void>
  removeAvatar(): Promise<void>
  rename(name: string): Promise<boolean>
  setStatus(status: PresenceStatus): void
  /** report to the sender that we've seen their messages in this conversation */
  markRead(friendId: string): void
  /** unread jam-chat messages while the jam chat window is closed */
  jamUnread: number
}

export const useSocial = create<SocialStore>((set, get) => ({
  snapshot: EMPTY_SOCIAL,
  loaded: false,
  busy: false,
  chats: {},
  openChats: [],
  chatWindows: {},
  chatLoading: {},
  closingChats: {},
  unread: {},
  typing: {},
  jamUnread: 0,

  load: async () => {
    if (get().loaded) return
    set({ loaded: true })
    let lastJamId: string | null = null
    let lastSeenJamChatId = 0
    api.social.onState((snapshot) => {
      // drop chat state for people no longer in the friend list
      const validIds = new Set(snapshot.friends.map((friend) => friend.id))
      const state = get()
      let openChats = state.openChats.filter((id) => id === JAM_CHAT_KEY || validIds.has(id))
      let jamUnread: number

      const jam = snapshot.jam
      if (!jam) {
        openChats = openChats.filter((id) => id !== JAM_CHAT_KEY)
        lastJamId = null
        lastSeenJamChatId = 0
        jamUnread = 0
      } else {
        const lastId = jam.chat.length > 0 ? (jam.chat[jam.chat.length - 1]?.id ?? 0) : 0
        if (jam.id !== lastJamId) {
          // joining a jam: history starts read
          lastJamId = jam.id
          lastSeenJamChatId = lastId
          jamUnread = 0
        } else if (openChats.includes(JAM_CHAT_KEY)) {
          lastSeenJamChatId = lastId
          jamUnread = 0
        } else {
          const me = snapshot.account?.id
          jamUnread = jam.chat.filter(
            (message) => message.id > lastSeenJamChatId && message.fromId !== me
          ).length
        }
      }

      set({ snapshot, openChats, jamUnread })
      if (!snapshot.account)
        set({ chats: {}, unread: {}, typing: {}, openChats: [], chatWindows: {}, jamUnread: 0 })
    })
    api.social.onChatMessage(({ friendId, message }) => {
      const state = get()
      const list = state.chats[friendId] ?? []
      const open = state.openChats.includes(friendId)
      if (open) api.social.chatRead(friendId, message.id)
      set({
        chats: { ...state.chats, [friendId]: [...list, message].slice(-300) },
        typing: { ...state.typing, [friendId]: 0 },
        unread: open ? state.unread : { ...state.unread, [friendId]: (state.unread[friendId] ?? 0) + 1 }
      })
    })
    api.social.onChatSent(({ friendId, tempId, id, at }) => {
      const state = get()
      const list = state.chats[friendId] ?? []
      set({
        chats: {
          ...state.chats,
          [friendId]: list.map((message) =>
            message.pending && String(message.id) === tempId
              ? { ...message, id, at, pending: false }
              : message
          )
        }
      })
    })
    api.social.onChatTyping(({ friendId }) => {
      set({ typing: { ...get().typing, [friendId]: Date.now() + TYPING_TTL } })
      setTimeout(() => {
        const state = get()
        if ((state.typing[friendId] ?? 0) <= Date.now())
          set({ typing: { ...state.typing, [friendId]: 0 } })
      }, TYPING_TTL + 100)
    })
    api.social.onChatRejected(({ friendId, tempId }) => {
      if (friendId && tempId) {
        // drop the optimistic bubble that the server refused
        set({
          chats: {
            ...get().chats,
            [friendId]: (get().chats[friendId] ?? []).filter((message) => String(message.id) !== tempId)
          }
        })
      }
      toast(socialError('rate_limited'), 'error')
    })
    const snapshot = await api.social.status()
    set({ snapshot })
  },

  createAccount: async () => {
    if (get().busy) return null
    set({ busy: true })
    const result = await api.social.createAccount()
    set({ busy: false })
    if (!result.ok) {
      toast(socialError(result.error), 'error')
      return null
    }
    return result.data
  },

  confirmAccount: async (code) => {
    if (get().busy) return false
    set({ busy: true })
    const result = await api.social.confirmAccount(code)
    set({ busy: false })
    if (!result.ok) {
      if (result.error !== 'code_mismatch') toast(socialError(result.error), 'error')
      return false
    }
    set({ snapshot: result.data })
    return true
  },

  login: async (code) => {
    if (get().busy) return false
    set({ busy: true })
    const result = await api.social.login(code)
    set({ busy: false })
    if (!result.ok) {
      toast(socialError(result.error), 'error')
      return false
    }
    set({ snapshot: result.data })
    toast(t('social.welcome', { name: result.data.account?.name ?? '' }), 'success')
    return true
  },

  logout: async () => {
    const snapshot = await api.social.logout()
    set({ snapshot })
  },

  deleteAccount: async () => {
    const result = await api.social.deleteAccount()
    if (!result.ok) {
      toast(socialError(result.error), 'error')
      return false
    }
    set({ snapshot: result.data })
    return true
  },

  addFriend: async (publicId) => {
    const result = await api.social.addFriend(publicId)
    if (!result.ok) {
      toast(socialError(result.error), 'error')
      return false
    }
    toast(t('social.requestSent'), 'success')
    return true
  },

  respondRequest: async (id, accept) => {
    const result = await api.social.respondRequest(id, accept)
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  removeFriend: async (userId) => {
    const result = await api.social.removeFriend(userId)
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  createJam: async () => {
    const result = await api.social.createJam()
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  inviteToJam: async (userId) => {
    const result = await api.social.inviteToJam(userId)
    if (!result.ok) {
      toast(socialError(result.error), 'error')
      return false
    }
    toast(t('social.jam.inviteSent'), 'success')
    return true
  },

  respondInvite: async (id, accept) => {
    const result = await api.social.respondInvite(id, accept)
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  leaveJam: async () => {
    const result = await api.social.leaveJam()
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  endJam: async () => {
    const result = await api.social.endJam()
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  setJamControl: async (allow) => {
    const result = await api.social.setJamControl(allow)
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  kickFromJam: async (userId) => {
    const result = await api.social.kickFromJam(userId)
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  transferJam: async (userId) => {
    const result = await api.social.transferJam(userId)
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  setStatus: (status) => {
    api.social.setStatus(status)
    // optimistic: the authoritative value comes back through onState
    set({ snapshot: { ...get().snapshot, myStatus: status } })
  },

  markRead: (friendId) => {
    const list = get().chats[friendId] ?? []
    for (let i = list.length - 1; i >= 0; i--) {
      const message = list[i]!
      if (!message.fromMe && !message.pending && typeof message.id === 'number' && message.id > 0) {
        api.social.chatRead(friendId, message.id)
        return
      }
    }
  },

  openChat: async (friendId) => {
    const state = get()
    if (state.closingChats[friendId]) {
      // reopened while the exit animation was playing — cancel the close
      const { [friendId]: _gone, ...rest } = state.closingChats
      set({ closingChats: rest, unread: { ...state.unread, [friendId]: 0 } })
      get().focusChat(friendId)
      return
    }
    if (state.openChats.includes(friendId)) {
      get().focusChat(friendId)
      set({ unread: { ...get().unread, [friendId]: 0 } })
      return
    }
    set({
      openChats: [...state.openChats, friendId],
      chatWindows: {
        ...state.chatWindows,
        [friendId]: state.chatWindows[friendId] ?? defaultChatRect(state.openChats.length)
      },
      chatLoading: { ...state.chatLoading, [friendId]: true },
      unread: { ...state.unread, [friendId]: 0 }
    })
    const result = await api.social.chatHistory(friendId)
    if (!get().openChats.includes(friendId)) return
    if (result.ok) {
      // keep any optimistic/pending messages that arrived while loading
      const existing = (get().chats[friendId] ?? []).filter((message) => message.pending)
      set({
        chats: { ...get().chats, [friendId]: [...result.data, ...existing] },
        chatLoading: { ...get().chatLoading, [friendId]: false }
      })
      get().markRead(friendId)
    } else {
      set({ chatLoading: { ...get().chatLoading, [friendId]: false } })
      toast(socialError(result.error), 'error')
    }
  },

  openJamChat: () => {
    const state = get()
    if (!state.snapshot.jam) return
    if (state.closingChats[JAM_CHAT_KEY]) {
      const { [JAM_CHAT_KEY]: _gone, ...rest } = state.closingChats
      set({ closingChats: rest, jamUnread: 0 })
      get().focusChat(JAM_CHAT_KEY)
      return
    }
    if (state.openChats.includes(JAM_CHAT_KEY)) {
      get().focusChat(JAM_CHAT_KEY)
      set({ jamUnread: 0 })
      return
    }
    set({
      openChats: [...state.openChats, JAM_CHAT_KEY],
      chatWindows: {
        ...state.chatWindows,
        [JAM_CHAT_KEY]: state.chatWindows[JAM_CHAT_KEY] ?? defaultChatRect(state.openChats.length)
      },
      jamUnread: 0
    })
  },

  closeChat: (friendId) => {
    const state = get()
    if (!state.openChats.includes(friendId) || state.closingChats[friendId]) return
    set({ closingChats: { ...state.closingChats, [friendId]: true } })
    setTimeout(() => {
      const current = get()
      if (!current.closingChats[friendId]) return // reopened during the exit animation
      const { [friendId]: _gone, ...rest } = current.closingChats
      set({ openChats: current.openChats.filter((id) => id !== friendId), closingChats: rest })
    }, 170)
  },

  focusChat: (friendId) => {
    const { openChats } = get()
    if (openChats[openChats.length - 1] === friendId || !openChats.includes(friendId)) return
    set({ openChats: [...openChats.filter((id) => id !== friendId), friendId] })
  },

  setChatRect: (friendId, rect) =>
    set({ chatWindows: { ...get().chatWindows, [friendId]: rect } }),

  sendChat: async (friendId, text) => {
    const trimmed = text.trim()
    if (!friendId || trimmed.length === 0) return
    if (!chatSendAllowed()) {
      toast(socialError('rate_limited'), 'error')
      return
    }
    const tempId = `t${Date.now()}-${tempCounter++}`
    const optimistic = {
      id: tempId as unknown as number,
      fromMe: true,
      text: trimmed,
      at: Date.now(),
      pending: true
    }
    set({ chats: { ...get().chats, [friendId]: [...(get().chats[friendId] ?? []), optimistic] } })
    const result = await api.social.chatSend(friendId, trimmed, tempId)
    if (!result.ok) {
      // remove the failed optimistic message
      set({
        chats: {
          ...get().chats,
          [friendId]: (get().chats[friendId] ?? []).filter(
            (message) => String(message.id) !== tempId
          )
        }
      })
      toast(socialError(result.error), 'error')
    }
  },

  notifyTyping: (friendId) => {
    if (friendId) api.social.chatTyping(friendId)
  },

  sendJamChat: (text) => {
    const trimmed = text.trim()
    if (trimmed.length === 0 || !get().snapshot.jam) return
    if (!chatSendAllowed()) {
      toast(socialError('rate_limited'), 'error')
      return
    }
    api.social.sendJamChat(trimmed)
  },

  setAvatar: async () => {
    const result = await api.social.setAvatar()
    if (!result.ok) toast(socialError(result.error), 'error')
    else if (result.data === true) toast(t('social.avatarUpdated'), 'success')
  },

  removeAvatar: async () => {
    const result = await api.social.removeAvatar()
    if (!result.ok) toast(socialError(result.error), 'error')
  },

  rename: async (name) => {
    const result = await api.social.rename(name)
    if (!result.ok) {
      toast(socialError(result.error), 'error')
      return false
    }
    toast(t('social.renamed'), 'success')
    return true
  }
}))
