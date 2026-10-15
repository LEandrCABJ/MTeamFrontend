import { readFileSync } from 'node:fs'
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Runs the notifications screens against the REAL backend and a disposable local PostgreSQL database:
 * no request is mocked. The administrator triggers the domain events through the real API (price
 * increase, medical certificate review, event cancellation, class changes) and the users read the
 * resulting notifications in the browser.
 *
 * Prerequisites (see frontend/README.md): backend running on a local test database, seeded with
 * `npm run seed:e2e:notifications -- --out <file>`, and these variables:
 *   E2E_REAL_API_URL  e.g. http://127.0.0.1:3100/api   (the backend must allow the origin http://127.0.0.1:4173)
 *   E2E_REAL_FIXTURE  the file written by the seed script
 */
const apiUrl = process.env.E2E_REAL_API_URL
const fixturePath = process.env.E2E_REAL_FIXTURE

interface Fixture {
  password: string
  admin: { id: string; email: string }
  member: { id: string; email: string }
  otherMember: { id: string; email: string }
  trainer: { id: string; email: string }
  branch: { id: string; name: string }
  certificateId: string
}

interface Notice { id: string; type: string; title: string; message: string; readAt: string | null }

function mondayOnOrAfter(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1)
  return date
}

const menuEntry = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: /Notificaciones/ })
const phoneBell = (page: Page) => page.locator('.app-topbar').getByRole('link', { name: /Notificaciones/ })
const inbox = (page: Page) => page.locator('.notification-list')
const articleTitled = (page: Page, title: string) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) })

async function loginThroughTheUi(page: Page, email: string, password: string) {
  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByPlaceholder('Ingresá tu contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/iniciar-sesion/)
}

test.describe('notificaciones con el backend y la base de datos reales', () => {
  test.skip(!apiUrl || !fixturePath, 'Define E2E_REAL_API_URL y E2E_REAL_FIXTURE para ejecutar la verificación real (ver README).')
  test.describe.configure({ mode: 'serial' })

  let fixture: Fixture
  let api: APIRequestContext
  let eventTitle: string
  const tokens: Record<'admin' | 'member' | 'otherMember' | 'trainer', string> = { admin: '', member: '', otherMember: '', trainer: '' }

  async function send(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, token: string, data?: unknown) {
    return api.fetch(`${apiUrl}${path}`, { method, headers: { Authorization: `Bearer ${token}` }, data })
  }

  async function inboxOf(token: string): Promise<{ items: Notice[]; total: number; unreadCount: number }> {
    const response = await send('GET', '/notifications?limit=50', token)
    expect(response.status()).toBe(200)
    return response.json()
  }

  async function login(email: string): Promise<string> {
    const response = await api.post(`${apiUrl}/auth/login`, { data: { email, password: fixture.password } })
    expect(response.status(), `login de ${email}`).toBe(200)
    return (await response.json()).accessToken
  }

  test.beforeAll(async () => {
    fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as Fixture
    api = await playwrightRequest.newContext()
    tokens.admin = await login(fixture.admin.email)
    tokens.member = await login(fixture.member.email)
    tokens.otherMember = await login(fixture.otherMember.email)
    tokens.trainer = await login(fixture.trainer.email)

    // The administrator drives the real business events.
    const created = async (path: string, data: unknown) => {
      const response = await send('POST', path, tokens.admin, data)
      expect(response.status(), `${path} ${await response.text()}`).toBe(201)
      return response.json()
    }
    await created('/membership-prices', { amount: 10000, effectiveFrom: '2092-01-01T03:00:00.000Z' })
    await created('/membership-prices', { amount: 12500.5, effectiveFrom: '2092-06-01T02:30:00.000Z' }) // 31/05/2092 23:30 in Buenos Aires
    await created('/membership-prices', { amount: 12500.5, effectiveFrom: '2092-07-01T03:00:00.000Z' }) // not an increase: no notice

    const review = await send('PATCH', `/medical-certificates/${fixture.certificateId}/review`, tokens.admin, { status: 'REJECTED', reviewComment: 'Falta la firma del profesional.' })
    expect(review.status()).toBe(200)

    eventTitle = `Torneo E2E ${Date.now()}`
    const eventData = { title: eventTitle, description: 'Evento de la prueba E2E', startsAt: '2092-03-04T02:30:00.000Z', location: 'Sede E2E', imageUrl: 'https://example.test/e2e.png' }
    const published = await created('/events', { ...eventData, status: 'PUBLISHED' })
    expect((await send('PATCH', `/events/${published.id}/status`, tokens.admin, { status: 'CANCELLED' })).status()).toBe(200)
    const draft = await created('/events', { ...eventData, title: `${eventTitle} (borrador)` })
    expect((await send('PATCH', `/events/${draft.id}/status`, tokens.admin, { status: 'CANCELLED' })).status()).toBe(200)

    const monday = mondayOnOrAfter('2092-03-01')
    const at = (days: number, hoursUtc: number) => new Date(monday.getTime() + days * 86_400_000 + hoursUtc * 3_600_000).toISOString()
    const classData = { weekStartsOn: monday.toISOString().slice(0, 10), activity: 'Yoga', startsAt: at(1, 15), branchId: fixture.branch.id, trainerId: fixture.trainer.id }
    const yoga = await created('/scheduled-classes', classData)
    expect((await send('PATCH', `/scheduled-classes/${yoga.id}`, tokens.admin, { startsAt: at(2, 13) })).status()).toBe(200)
    const pilates = await created('/scheduled-classes', { ...classData, activity: 'Pilates' })
    expect((await send('DELETE', `/scheduled-classes/${pilates.id}`, tokens.admin)).status()).toBe(204)
  })

  test.afterAll(async () => {
    await api.dispose()
  })

  test('la API real entrega a cada cuenta solo sus avisos, con los textos y la zona horaria correctos', async () => {
    const member = await inboxOf(tokens.member)
    expect(member.items.map(({ title }) => title)).toEqual(['Cuota próxima a vencer', 'Evento cancelado', 'Apto médico rechazado', 'Aumento de cuota'])
    expect(member.unreadCount).toBe(4)
    const byTitle = (items: Notice[], title: string) => items.find((item) => item.title === title)?.message
    expect(byTitle(member.items, 'Aumento de cuota')).toBe('La cuota mensual pasa a ser de $ 12.500,50 desde el 31/05/2092.')
    expect(byTitle(member.items, 'Apto médico rechazado')).toBe('Tu apto médico fue rechazado. Observación: Falta la firma del profesional.')
    expect(byTitle(member.items, 'Evento cancelado')).toBe(`Se canceló el evento "${eventTitle}" previsto para el 03/03/2092 a las 23:30.`)
    expect(byTitle(member.items, 'Cuota próxima a vencer')).toMatch(/^Tu cuota vence el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2}\.$/)

    const other = await inboxOf(tokens.otherMember)
    expect(other.items.map(({ title }) => title)).toEqual(['Cuota vencida', 'Evento cancelado', 'Aumento de cuota'])

    const trainer = await inboxOf(tokens.trainer)
    expect(trainer.items.map(({ title }) => title).sort()).toEqual(['Clase asignada', 'Clase asignada', 'Clase cancelada', 'Clase modificada', 'Evento cancelado'])
    expect(byTitle(trainer.items, 'Clase modificada')).toMatch(/^Se modificó la clase de Yoga: el horario cambió del 04\/03\/2092 a las 12:00 al 05\/03\/2092 a las 10:00\.$/)
    expect(byTitle(trainer.items, 'Clase cancelada')).toBe(`Se canceló la clase de Pilates del 04/03/2092 a las 12:00 en ${fixture.branch.name}.`)
  })

  test('una cuenta no puede ver ni leer los avisos de otra, y sin sesión no se accede', async () => {
    const trainerNotice = (await inboxOf(tokens.trainer)).items[0]!
    const foreign = await send('GET', `/notifications/${trainerNotice.id}`, tokens.member)
    expect(foreign.status()).toBe(404)
    const missing = await send('GET', '/notifications/00000000-0000-4000-8000-000000000000', tokens.member)
    expect(await foreign.json()).toEqual(await missing.json())
    expect((await send('PATCH', `/notifications/${trainerNotice.id}/read-status`, tokens.member)).status()).toBe(404)
    expect((await send('GET', '/notifications?userId=' + fixture.trainer.id, tokens.member)).status()).toBe(400)
    expect((await inboxOf(tokens.trainer)).items.find((item) => item.id === trainerNotice.id)?.readAt).toBeNull()
    expect((await api.get(`${apiUrl}/notifications`)).status()).toBe(401)
  })

  test('el socio ve sus avisos en la interfaz, marca uno y todos como leídos, y el estado persiste', async ({ page }) => {
    await loginThroughTheUi(page, fixture.member.email, fixture.password)
    await expect(page).toHaveURL(/\/socio$/)
    await expect(menuEntry(page)).toContainText('4 notificaciones sin leer')
    await menuEntry(page).click()
    await expect(page).toHaveURL(/\/socio\/notificaciones$/)

    const articles = page.getByRole('article')
    await expect(articles).toHaveCount(4)
    await expect(articles.nth(0)).toContainText('Cuota próxima a vencer')
    await expect(articles.nth(1)).toContainText('Evento cancelado')
    await expect(articles.nth(2)).toContainText('Apto médico rechazado')
    await expect(articles.nth(3)).toContainText('Aumento de cuota')
    await expect(articleTitled(page, 'Aumento de cuota')).toContainText('La cuota mensual pasa a ser de $ 12.500,50 desde el 31/05/2092.')
    await expect(articleTitled(page, 'Apto médico rechazado')).toContainText('Observación: Falta la firma del profesional.')
    await expect(articleTitled(page, 'Evento cancelado')).toContainText('previsto para el 03/03/2092 a las 23:30.')
    await expect(page.locator('article.is-unread')).toHaveCount(4)
    await expect(inbox(page).getByText('Clase asignada')).toHaveCount(0)

    await articleTitled(page, 'Apto médico rechazado').getByRole('button', { name: 'Marcar como leída' }).click()
    await expect(articleTitled(page, 'Apto médico rechazado')).toContainText('Leída')
    await expect(menuEntry(page)).toContainText('3 notificaciones sin leer')
    await page.reload()
    await expect(articleTitled(page, 'Apto médico rechazado')).toContainText('Leída')
    await expect(page.locator('article.is-unread')).toHaveCount(3)
    await expect(menuEntry(page)).toContainText('3 notificaciones sin leer')

    await page.getByRole('button', { name: 'Marcar todas como leídas' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Todas las notificaciones se marcaron como leídas.' })).toBeVisible()
    await expect(page.locator('article.is-unread')).toHaveCount(0)
    await expect(page.locator('.app-nav-badge')).toHaveCount(0)
    await page.reload()
    await expect(articles).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled()

    const stored = await inboxOf(tokens.member)
    expect(stored.total).toBe(4)
    expect(stored.unreadCount).toBe(0)
    expect(stored.items.every((item) => item.readAt !== null)).toBe(true)
  })

  test('el entrenador ve sus clases y el evento cancelado, y no los avisos de cuota ni de aptos', async ({ page }) => {
    await loginThroughTheUi(page, fixture.trainer.email, fixture.password)
    await expect(page).toHaveURL(/\/entrenador$/)
    await expect(menuEntry(page)).toContainText('5 notificaciones sin leer')
    await menuEntry(page).click()

    await expect(page.getByRole('article')).toHaveCount(5)
    await expect(articleTitled(page, 'Clase cancelada')).toContainText('Se canceló la clase de Pilates')
    await expect(articleTitled(page, 'Clase modificada')).toContainText('el horario cambió del 04/03/2092 a las 12:00 al 05/03/2092 a las 10:00')
    await expect(articleTitled(page, 'Clase asignada')).toHaveCount(2)
    await expect(articleTitled(page, 'Evento cancelado')).toBeVisible()
    await expect(inbox(page).getByText('Aumento de cuota')).toHaveCount(0)
    await expect(inbox(page).getByText('Apto médico')).toHaveCount(0)
    await expect(inbox(page).getByText(/Cuota/)).toHaveCount(0)
  })

  test.describe('en el celular', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('otro socio llega desde la campana, ve solo lo suyo y marca todo como leído', async ({ page }) => {
      await loginThroughTheUi(page, fixture.otherMember.email, fixture.password)
      await expect(phoneBell(page)).toContainText('3 notificaciones sin leer')
      await phoneBell(page).click()
      await expect(page).toHaveURL(/\/socio\/notificaciones$/)

      await expect(page.getByRole('article')).toHaveCount(3)
      await expect(articleTitled(page, 'Cuota vencida')).toContainText('Tu cuota se encuentra vencida.')
      await expect(inbox(page).getByText('Apto médico')).toHaveCount(0)
      await expect(inbox(page).getByText('Cuota próxima a vencer')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

      await page.getByRole('button', { name: 'Marcar todas como leídas' }).tap()
      await expect(page.locator('article.is-unread')).toHaveCount(0)
      await expect(page.locator('.app-topbar .app-nav-badge')).toHaveCount(0)
      expect((await inboxOf(tokens.otherMember)).unreadCount).toBe(0)
    })
  })
})
