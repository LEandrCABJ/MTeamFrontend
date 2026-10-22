import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import type { Event } from '../../service/backend-api'
import { EventsScreen } from './EventsScreen'

const eventRecord = (overrides: Partial<Event> = {}): Event => ({
  id: 'event-1',
  title: 'Jornada de entrenamiento',
  description: 'Una jornada abierta para socios.',
  startsAt: '2030-09-06T15:00:00.000Z',
  location: 'Sede Centro',
  imageUrl: 'https://example.com/event.jpg',
  status: 'PUBLISHED',
  displayStatus: 'UPCOMING',
  createdById: 'admin-id',
  ...overrides,
})

const eventPage = (items: Event[], page = 1, total = items.length) => ({ items, page, limit: 12, total })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('EventsScreen', () => {
  it('muestra eventos al socio sin exponer acciones administrativas', async () => {
    stubApi([{ path: '/events', handler: () => ({ body: eventPage([eventRecord()]) }) }])
    renderWithSession(<EventsScreen/>, { user: testUser('MEMBER') })

    expect(await screen.findByRole('heading', { name: 'Jornada de entrenamiento' })).toBeInTheDocument()
    expect(screen.getByText('Sede Centro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo evento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument()
  })

  it('reintenta una carga fallida y muestra el estado vacío', async () => {
    let failed = false
    stubApi([{ path: '/events', handler: () => {
      if (!failed) { failed = true; return { status: 503, body: { message: 'No se pudieron cargar los eventos.' } } }
      return { body: eventPage([]) }
    } }])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los eventos.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay eventos para los filtros seleccionados.')).toBeInTheDocument()
  })

  it('envía el filtro administrativo y reinicia la página al cambiarlo', async () => {
    const fetchStub = stubApi([{ path: '/events', handler: (url) => ({ body: eventPage([
      eventRecord({ id: `event-${url.searchParams.get('page')}`, title: `Evento ${url.searchParams.get('page')}` }),
    ], Number(url.searchParams.get('page') ?? '1'), 24) }) }])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })

    expect(await screen.findByRole('heading', { name: 'Evento 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('heading', { name: 'Evento 2' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'DRAFT' } })
    expect(await screen.findByRole('heading', { name: 'Evento 1' })).toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/events').at(-1)?.url.searchParams.toString()).toContain('status=DRAFT'))
    expect(requestsTo(fetchStub, 'GET', '/events').at(-1)?.url.searchParams.get('page')).toBe('1')
  })

  it('crea un borrador usando el horario local del gimnasio y actualiza la lista', async () => {
    let savedEvent: Event | null = null
    const fetchStub = stubApi([
      { path: '/events', handler: () => ({ body: eventPage(savedEvent ? [savedEvent] : []) }) },
      { method: 'POST', path: '/events', handler: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Partial<Event>
        savedEvent = eventRecord({ ...body, id: 'event-new', status: 'DRAFT' })
        return { status: 201, body: savedEvent }
      } },
    ])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo evento' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Encuentro de socios' } })
    fireEvent.change(screen.getByLabelText('Fecha y horario'), { target: { value: '2030-10-01T18:30' } })
    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'Sede Norte' } })
    fireEvent.change(screen.getByLabelText('Imagen (URL)'), { target: { value: 'https://example.com/new.jpg' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Actividad abierta.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByRole('heading', { name: 'Encuentro de socios' })).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'POST', '/events')[0]?.body).toMatchObject({
      title: 'Encuentro de socios', startsAt: '2030-10-01T18:30:00-03:00', status: 'DRAFT',
    })
  })

  it('edita un evento existente y conserva el formulario al fallar el guardado', async () => {
    const currentEvent = eventRecord({ status: 'DRAFT' })
    stubApi([
      { path: '/events', handler: () => ({ body: eventPage([currentEvent]) }) },
      { method: 'PATCH', path: '/events/event-1', handler: () => ({ status: 503, body: { message: 'No se pudo guardar el evento.' } }) },
    ])
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })
    const card = (await screen.findByRole('heading', { name: currentEvent.title })).closest('article') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Editar' }))
    expect(screen.getByRole('heading', { name: 'Editar evento' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título actualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el evento.')
    expect(screen.getByLabelText('Título')).toHaveValue('Título actualizado')
  })

  it.each([
    ['DRAFT', 'Publicar', 'PUBLISHED'],
    ['PUBLISHED', 'Cancelar evento', 'CANCELLED'],
  ] as const)('confirma el cambio de estado %s → %s', async (status, action, nextStatus) => {
    let currentEvent = eventRecord({ status })
    const fetchStub = stubApi([
      { path: '/events', handler: () => ({ body: eventPage([currentEvent]) }) },
      { method: 'PATCH', path: '/events/event-1/status', handler: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Partial<Event>
        currentEvent = eventRecord({ ...currentEvent, ...body, displayStatus: nextStatus === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING' })
        return { body: currentEvent }
      } },
    ])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithSession(<EventsScreen isAdmin/>, { user: testUser('ADMIN') })
    const card = (await screen.findByRole('heading', { name: currentEvent.title })).closest('article') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: action }))

    expect(confirm).toHaveBeenCalledOnce()
    await waitFor(() => expect(requestsTo(fetchStub, 'PATCH', '/events/event-1/status')[0]?.body).toEqual({ status: nextStatus }))
    expect(await within(card).findByText(nextStatus === 'CANCELLED' ? 'Cancelado' : 'Próximo')).toBeInTheDocument()
  })
})
