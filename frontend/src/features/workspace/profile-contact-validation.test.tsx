import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, testUser } from '../../test/test-utils'
import { backendApi, type OwnProfile } from '../../service/backend-api'
import { ContactDataCard } from './ProfileEditorCards'

const PROFILE: OwnProfile = {
  ...testUser('MEMBER'), documentNumber: '30111222', birthDate: '1990-01-02', phone: '1122334455', photoUrl: null,
  memberProfile: { emergencyContactName: 'Ana Pérez', emergencyContactPhone: '1199999999' },
  trainerProfile: null,
}

describe.each(['MEMBER', 'TRAINER'] as const)('contact validation: %s', (role) => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  function setup() {
    const update = vi.spyOn(backendApi, 'updateOwnProfile').mockResolvedValue(PROFILE)
    renderWithSession(<ContactDataCard profile={{ ...PROFILE, email: 'ana@example.com', role }} role={role} onUpdated={() => undefined}/>, { user: testUser(role) })
    return update
  }

  it.each([
    ['anaexample.com', '1122334455'], ['ana@example', '1122334455'],
    ['ana@example.', '1122334455'], ['ana@.com', '1122334455'],
    ['ana @example.com', '1122334455'], ['ana@example.com', '11abc34455'],
    ['ana@example.com', '112233'], ['ana@example.com', '+55 11 2233-4455'],
    ['ana@example.com', '541122334455'],
  ])('blocks invalid email/phone %s %s', (email, phone) => {
    const update = setup()
    fireEvent.change(screen.getByDisplayValue('ana@example.com'), { target: { value: email } })
    fireEvent.change(screen.getByDisplayValue('1122334455'), { target: { value: phone } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(update).not.toHaveBeenCalled()
    expect(screen.queryByText('Cambios guardados correctamente.')).not.toBeInTheDocument()
    const invalid = document.querySelector('[aria-invalid="true"]')!
    expect(document.getElementById(invalid.getAttribute('aria-describedby')!)).toHaveAttribute('role', 'alert')
  })

  it.each(['11 2233-4455', '+54 (11) 2233-4455', '+54 9 11 2233-4455'])('saves valid contact %s and trims email', async (phone) => {
    const update = setup()
    fireEvent.change(screen.getByDisplayValue('ana@example.com'), { target: { value: ' ana@example.com ' } })
    fireEvent.change(screen.getByDisplayValue('1122334455'), { target: { value: phone } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Cambios guardados correctamente.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@example.com', phone }))
  })

  if (role === 'MEMBER') {
    it.each(['abc', '1122', '+55 11 2233-4455'])('blocks invalid emergency phone %s', (phone) => {
      const update = setup()
      fireEvent.change(screen.getByDisplayValue('1199999999'), { target: { value: phone } })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      expect(update).not.toHaveBeenCalled()
      expect(screen.getByDisplayValue(phone)).toHaveAttribute('aria-invalid', 'true')
    })
    it('blocks blank emergency name and resets errors on cancel', () => {
      const update = setup()
      fireEvent.change(screen.getByDisplayValue('Ana Pérez'), { target: { value: '  ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      expect(update).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByDisplayValue('Ana Pérez')).toBeInTheDocument()
    })
  }
})
