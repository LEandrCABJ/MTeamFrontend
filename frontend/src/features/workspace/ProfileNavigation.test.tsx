import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../authentication/AuthProvider'
import { authStorage } from '../authentication/auth-storage'
import { requestsTo, stubApi, testUser } from '../../test/test-utils'
import { RoleWorkspace } from './RoleWorkspace'
import type { UserRole } from '../authentication/auth-types'

function renderWorkspace(role: UserRole, section = 'perfil') {
  const base = role === 'MEMBER' ? '/socio' : '/entrenador'
  return render(<MemoryRouter initialEntries={[`${base}/${section}`]}><AuthProvider><Routes>
    <Route path={`${base}/*`} element={<RoleWorkspace role={role}/>}/>
    <Route path="/iniciar-sesion" element={<p>Pantalla de ingreso</p>}/>
  </Routes></AuthProvider></MemoryRouter>)
}

afterEach(() => { cleanup(); authStorage.clear(); vi.unstubAllGlobals() })

describe.each(['MEMBER', 'TRAINER'] as const)('profile navigation for %s', (role) => {
  function setup(photoUrl: string | null = null, isPersistent = false) {
    const user = testUser(role)
    authStorage.write({ user, accessToken: 'profile-test-token', tokenType: 'Bearer', expiresIn: 3600 }, isPersistent)
    let profile = { ...user, photoUrl, documentNumber: '30111222', birthDate: '1990-01-02', phone: '1100000000', memberProfile: null, trainerProfile: null }
    const fetchStub = stubApi([
      { path: '/auth/me', handler: () => ({ body: profile }) },
      { path: '/users/me', handler: () => ({ body: profile }) },
      { method: 'PUT', path: '/users/me/photo', handler: () => {
        profile = { ...profile, photoUrl: 'https://example.com/new-photo.jpg' }
        return { body: profile }
      } },
      { path: '/members/me/membership', handler: () => ({ body: { currentPrice: null, status: 'EXPIRED', daysRemaining: 0 } }) },
      { path: '/members/me/payments', handler: () => ({ body: { items: [], total: 0, page: 1, limit: 20 } }) },
      { path: '/members/me/medical-certificates', handler: () => ({ body: { items: [], total: 0, page: 1, limit: 20, initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false } } }) },
      { method: 'POST', path: '/auth/logout', handler: () => ({ status: 204 }) },
    ])
    return { user, fetchStub }
  }

  it.each([false, true])('loads the photo, updates navigation after upload and preserves it after reload (persistent=%s)', async (isPersistent) => {
    const { user, fetchStub } = setup('https://example.com/current-photo.jpg', isPersistent)
    const view = renderWorkspace(role)
    const sidebar = document.querySelector('.app-sidebar-user') as HTMLElement
    const mobileBar = screen.getByRole('region', { name: 'Cuenta de usuario' })
    const photoName = `Foto de perfil de ${user.firstName} ${user.lastName}`
    await waitFor(() => expect(within(sidebar).getByRole('img', { name: photoName })).toHaveAttribute('src', 'https://example.com/current-photo.jpg'))
    expect(within(mobileBar).getByRole('img', { name: photoName })).toHaveAttribute('src', 'https://example.com/current-photo.jpg')
    fireEvent.change(await screen.findByLabelText(/Cambiar fotografía/), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } })
    await waitFor(() => expect(within(sidebar).getByRole('img')).toHaveAttribute('src', 'https://example.com/new-photo.jpg'))
    expect(within(mobileBar).getByRole('img')).toHaveAttribute('src', 'https://example.com/new-photo.jpg')
    expect(authStorage.read()?.user.photoUrl).toBe('https://example.com/new-photo.jpg')
    expect(fetchStub.mock.calls.filter(([input, init]) => String(input).endsWith('/users/me/photo') && init?.method === 'PUT')).toHaveLength(1)
    const upload = fetchStub.mock.calls.find(([, init]) => init?.method === 'PUT')?.[1]?.body
    expect(upload).toBeInstanceOf(FormData)
    expect((upload as FormData).get('file')).toBeInstanceOf(File)
    view.unmount()
    renderWorkspace(role, 'acceso')
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Cuenta de usuario' })).getByRole('img')).toHaveAttribute('src', 'https://example.com/new-photo.jpg'))
  })

  it('keeps initials and displays the API error if the upload fails', async () => {
    const { fetchStub } = setup()
    const originalFetch = fetchStub.getMockImplementation()!
    fetchStub.mockImplementation((input, init) => init?.method === 'PUT'
      ? Promise.resolve(new Response(JSON.stringify({ message: 'No se pudo guardar la foto' }), { status: 503 }))
      : originalFetch(input, init))
    renderWorkspace(role)
    fireEvent.change(await screen.findByLabelText(/Cambiar fotografía/), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la foto')
    expect(within(screen.getByRole('region', { name: 'Cuenta de usuario' })).getByRole('img')).toHaveAccessibleName(/Iniciales/)
    expect(authStorage.read()?.user.photoUrl).toBeNull()
  })

  it.each([204, 503])('logs out from the mobile account bar and clears both storage locations (HTTP %s)', async (status) => {
    const { fetchStub } = setup(null, true)
    const originalFetch = fetchStub.getMockImplementation()!
    fetchStub.mockImplementation((input, init) => String(input).endsWith('/auth/logout')
      ? Promise.resolve(new Response(status === 204 ? null : JSON.stringify({ message: 'Sin conexión' }), { status }))
      : originalFetch(input, init))
    renderWorkspace(role, 'acceso')
    fireEvent.click(within(screen.getByRole('region', { name: 'Cuenta de usuario' })).getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
    expect(localStorage.getItem('mteam.auth')).toBeNull()
    expect(sessionStorage.getItem('mteam.auth')).toBeNull()
    expect(requestsTo(fetchStub, 'POST', '/auth/logout')).toHaveLength(1)
  })
})
