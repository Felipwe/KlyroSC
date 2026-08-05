import { create } from 'zustand'
import {
  EMPTY_SOCIAL,
  type ChatMessage,
  type NewSocialAccount,
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

interface SocialStore {
  snapshot: SocialSnapshot
  loaded: boolean
  busy: boolean
  /** friendId → loaded message window (oldest→newest) */
  chats: Record<string, ChatMessage[]>
  chatOpen: string | null
  chatLoading: boolean
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
  openChat(friendId: string): Promise<void>
  closeChat(): void
  sendChat(text: string): Promise<void>
  notifyTyping(): void
}

export const useSocial = create<SocialStore>((set, get) => ({
  snapshot: EMPTY_SOCIAL,
  loaded: false,
  busy: false,
  chats: {},
  chatOpen: null,
  chatLoading: false,
  unread: {},
  typing: {},

  load: async () => {
    if (get().loaded) return
    set({ loaded: true })
    api.social.onState((snapshot) => {
      // drop chat state for people no longer in the friend list
      const validIds = new Set(snapshot.friends.map((friend) => friend.id))
      const state = get()
      const chatOpen = state.chatOpen && validIds.has(state.chatOpen) ? state.chatOpen : null
      set({ snapshot, chatOpen })
      if (!snapshot.account) set({ chats: {}, unread: {}, typing: {} })
    })
    api.social.onChatMessage(({ friendId, message }) => {
      const state = get()
      const list = state.chats[friendId] ?? []
      set({
        chats: { ...state.chats, [friendId]: [...list, message].slice(-300) },
        typing: { ...state.typing, [friendId]: 0 },
        unread:
          state.chatOpen === friendId
            ? state.unread
            : { ...state.unread, [friendId]: (state.unread[friendId] ?? 0) + 1 }
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

  openChat: async (friendId) => {
    set({
      chatOpen: friendId,
      chatLoading: true,
      unread: { ...get().unread, [friendId]: 0 }
    })
    const result = await api.social.chatHistory(friendId)
    if (get().chatOpen !== friendId) return
    if (result.ok) {
      // keep any optimistic/pending messages that arrived while loading
      const existing = (get().chats[friendId] ?? []).filter((message) => message.pending)
      set({
        chats: { ...get().chats, [friendId]: [...result.data, ...existing] },
        chatLoading: false
      })
    } else {
      set({ chatLoading: false })
      toast(socialError(result.error), 'error')
    }
  },

  closeChat: () => set({ chatOpen: null }),

  sendChat: async (text) => {
    const friendId = get().chatOpen
    const trimmed = text.trim()
    if (!friendId || trimmed.length === 0) return
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

  notifyTyping: () => {
    const friendId = get().chatOpen
    if (friendId) api.social.chatTyping(friendId)
  }
}))
