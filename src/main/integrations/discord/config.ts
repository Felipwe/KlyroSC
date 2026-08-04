import { DEFAULT_DISCORD_CLIENT_ID } from '@shared/constants'

export function resolveDiscordClientId(settingsClientId: string): string {
  if (/^\d{15,21}$/.test(settingsClientId)) return settingsClientId
  const env = process.env.KLYRO_DISCORD_CLIENT_ID ?? ''
  if (/^\d{15,21}$/.test(env)) return env
  return DEFAULT_DISCORD_CLIENT_ID
}
