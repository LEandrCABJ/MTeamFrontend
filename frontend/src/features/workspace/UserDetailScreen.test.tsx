import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, stubApi, testUser } from '../../test/test-utils'
import { UserDetailScreen } from './UserDetailScreen'

const temporaryPassword = 'AbCdEf0123456789_XyZ-abcdefghij0123456789abc'
const userDetail = {
  id: 'user-1',
  firstName: 'Ana',
  lastName: 'Lara',
  documentNumber: '30111222',
  birthDate: '1990-01-02',
  email: 'ana@example.com',
  phone: '1100000000',
  photoUrl: null,
  role: 'MEMBER' as const,
  status: 'ACTIVE' as const,
  isPasswordChangeRequired: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  memberProfile: { emergencyContactName: 'Contacto', emergencyContactPhone: '1100000001' },
  trainerProfile: null,
  membership: null,
  payments: [],
  medicalCertificates: [],
  trainerBranches: [],
  classes: [],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('UserDetailScreen password reset', () => {
  it('requests a server-generated temporary password and displays it once', async () => {
    const fetchStub = stubApi([
      { path: '/users/user-1', handler: () => ({ body: userDetail }) },
      { path: '/users/user-1/audit-logs', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) },
      { method: 'POST', path: '/users/user-1/password-resets', handler: () => ({ body: { temporaryPassword } }) },
    ])
    renderWithSession(<UserDetailScreen id="user-1" />, {
      user: testUser('ADMIN'),
      route: '/admin/usuarios/user-1',
    })

    fireEvent.click((await screen.findAllByRole('button', { name: /restablecer contraseña/i }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'Generar contraseña temporal' }))

    expect(await screen.findByLabelText('Contraseña temporal generada')).toHaveValue(temporaryPassword)
    expect(fetchStub.mock.calls.some(([, init]) => init?.method === 'POST' && init.body === undefined)).toBe(true)
    expect(screen.queryByLabelText('Nueva contraseña temporal')).not.toBeInTheDocument()
  })
})
