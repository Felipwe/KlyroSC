export interface AuthUser {
  id: number
  name: string
  handle: string
  avatar: string | null
  url: string
}

export interface AuthState {
  loggedIn: boolean
  user: AuthUser | null
}

export const LOGGED_OUT: AuthState = { loggedIn: false, user: null }
