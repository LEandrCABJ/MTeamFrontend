import { apiRequest } from '../../service/api-client'
import type { OwnProfile } from '../../service/backend-api'
import type { ChangePasswordInput, LoginCredentials, LoginResponse, RegisterInput } from './auth-types'

export const authService = {
  requestRecovery(email: string) {
    return apiRequest<{ message: string }>('/auth/password-recovery', { method: 'POST', body: { email }, authenticated: false })
  },
  completeRecovery(token: string, newPassword: string) {
    return apiRequest<void>('/auth/password-recovery/complete', { method: 'POST', body: { token, newPassword }, authenticated: false })
  },
  login(credentials: LoginCredentials) {
    return apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: credentials, authenticated: false })
  },
  register(input: RegisterInput) {
    return apiRequest<void>('/auth/register', { method: 'POST', body: input, authenticated: false })
  },
  logout() {
    return apiRequest<void>('/auth/logout', { method: 'POST' })
  },
  currentIdentity() {
    return apiRequest<OwnProfile>('/auth/me')
  },
  changePassword(input: ChangePasswordInput) {
    return apiRequest<void>('/auth/password', { method: 'PATCH', body: input })
  },
}
