import { dialog, nativeImage } from 'electron'
import { IPC } from '@shared/types/ipc'
import { type JamTrackRef } from '@shared/types/social'
import { handle, handleResult, on } from './core'
import { type AppContext } from './index'

const isTrackRef = (value: unknown): value is JamTrackRef => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.trackId === 'number' &&
    typeof v.title === 'string' &&
    typeof v.artist === 'string' &&
    (v.artwork === null || typeof v.artwork === 'string') &&
    typeof v.duration === 'number'
  )
}

export function registerSocialIpc(ctx: AppContext): void {
  const social = ctx.social

  handle(IPC.socialStatus, () => social.status())
  handleResult(IPC.socialCreateAccount, () => social.createAccount())
  handleResult(IPC.socialConfirmAccount, (accountNumber) => {
    if (typeof accountNumber !== 'string') throw new Error('invalid_payload')
    return social.confirmAccount(accountNumber)
  })
  handleResult(IPC.socialLogin, (accountNumber) => {
    if (typeof accountNumber !== 'string') throw new Error('invalid_payload')
    return social.login(accountNumber)
  })
  handle(IPC.socialLogout, () => social.logout())
  handleResult(IPC.socialDeleteAccount, () => social.deleteAccount())

  handleResult(IPC.socialAddFriend, (publicId) => {
    if (typeof publicId !== 'number' || !Number.isInteger(publicId) || publicId < 1)
      throw new Error('invalid_id')
    return social.addFriend(publicId)
  })
  handleResult(IPC.socialRespondRequest, (payload) => {
    const p = payload as { id?: unknown; accept?: unknown }
    if (typeof p?.id !== 'string') throw new Error('invalid_payload')
    return social.respondRequest(p.id, p.accept === true)
  })
  handleResult(IPC.socialRemoveFriend, (userId) => {
    if (typeof userId !== 'string') throw new Error('invalid_payload')
    return social.removeFriend(userId)
  })

  handleResult(IPC.socialCreateJam, () => social.createJam())
  handleResult(IPC.socialInviteToJam, (userId) => {
    if (typeof userId !== 'string') throw new Error('invalid_payload')
    return social.inviteToJam(userId)
  })
  handleResult(IPC.socialRespondInvite, (payload) => {
    const p = payload as { id?: unknown; accept?: unknown }
    if (typeof p?.id !== 'string') throw new Error('invalid_payload')
    return social.respondInvite(p.id, p.accept === true)
  })
  handleResult(IPC.socialLeaveJam, () => social.leaveJam())
  handleResult(IPC.socialEndJam, () => social.endJam())
  handleResult(IPC.socialSetJamControl, (allow) => social.setJamControl(allow === true))
  handleResult(IPC.socialJamKick, (userId) => {
    if (typeof userId !== 'string') throw new Error('invalid_payload')
    return social.kickFromJam(userId)
  })
  handleResult(IPC.socialJamTransfer, (userId) => {
    if (typeof userId !== 'string') throw new Error('invalid_payload')
    return social.transferJam(userId)
  })

  on(IPC.socialReconnect, () => social.reconnectNow())
  handleResult(IPC.socialChatHistory, (payload) => {
    const p = payload as { friendId?: unknown; before?: unknown }
    if (typeof p?.friendId !== 'string') throw new Error('invalid_payload')
    return social.chatHistory(p.friendId, typeof p.before === 'number' ? p.before : undefined)
  })
  handleResult(IPC.socialChatSend, (payload) => {
    const p = payload as { friendId?: unknown; text?: unknown; tempId?: unknown }
    if (typeof p?.friendId !== 'string' || typeof p?.text !== 'string' || typeof p?.tempId !== 'string')
      throw new Error('invalid_payload')
    return social.chatSend(p.friendId, p.text, p.tempId)
  })
  on(IPC.socialChatTyping, (friendId) => {
    if (typeof friendId === 'string') social.chatTyping(friendId)
  })
  on(IPC.socialJamChatSend, (text) => {
    if (typeof text === 'string') social.sendJamChat(text)
  })
  on(IPC.socialJamPlaybackSend, (payload) => {
    const p = payload as { track?: unknown; playing?: unknown; position?: unknown }
    if (!p || typeof p.playing !== 'boolean' || typeof p.position !== 'number') return
    if (p.track !== null && !isTrackRef(p.track)) return
    social.sendJamPlayback({
      track: p.track === null ? null : (p.track as JamTrackRef),
      playing: p.playing,
      position: p.position
    })
  })
  on(IPC.socialJamQueueSend, (queue) => {
    if (!Array.isArray(queue)) return
    social.sendJamQueue(queue.filter(isTrackRef))
  })

  handleResult(IPC.socialSetAvatar, async () => {
    const window = ctx.mainWindow.get()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
    })
    const file = result.filePaths[0]
    if (result.canceled || !file) return null
    const image = nativeImage.createFromPath(file)
    if (image.isEmpty()) throw new Error('invalid_avatar')
    const size = image.getSize()
    const side = Math.min(size.width, size.height)
    // center-crop to a square before shrinking so faces stay centered
    const cropped = image.crop({
      x: Math.floor((size.width - side) / 2),
      y: Math.floor((size.height - side) / 2),
      width: side,
      height: side
    })
    const resized = cropped.resize({ width: 128, height: 128, quality: 'best' })
    const dataUrl = `data:image/jpeg;base64,${resized.toJPEG(80).toString('base64')}`
    if (dataUrl.length > 90_000) throw new Error('invalid_avatar')
    await social.setAvatar(dataUrl)
    return true
  })
  handleResult(IPC.socialRemoveAvatar, () => social.setAvatar(null))
  handleResult(IPC.socialRename, (name) => {
    if (typeof name !== 'string' || name.length > 64) throw new Error('invalid_name')
    return social.rename(name)
  })
}
