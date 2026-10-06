const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(process.env.AGENDA_FRONTEND_DIST || path.join(__dirname, '../../dist'))
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html' }
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname)
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403)
    res.end()
    return
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  res.end(fs.readFileSync(file))
})
async function scenario(browser, width, theme) {
  console.log('Revisando', width, theme)
  const context = await browser.newContext({
    viewport: { width, height: 950 },
    timezoneId: 'America/Guatemala',
    reducedMotion: 'reduce',
  })
  await context.addInitScript(
    ({ theme }) => {
      localStorage.setItem('accessToken', 'test-token')
      localStorage.setItem('refreshToken', 'refresh')
      localStorage.setItem(
        'authUser',
        JSON.stringify({
          email: 'abogada@system.com',
          dpi: '3002234560901',
          firstName: 'Ana',
          lastName: 'Gómez',
          role: 'Abogada',
        }),
      )
      localStorage.setItem('legal-administrator-theme', theme)
    },
    { theme },
  )
  const page = await context.newPage(),
    errors = [],
    requested = [],
    created = [],
    edits = []
  page.setDefaultTimeout(10000)
  page.on('pageerror', (error) => errors.push(error.message))
  const now = new Date(),
    day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(now)
  const fixture = {
    id: 1,
    title: 'Consulta de prueba',
    type: 'APPOINTMENT',
    description: 'Notas privadas',
    startsAt: now.toISOString(),
    endsAt: new Date(now.getTime() + 3600000).toISOString(),
    timeZone: 'America/Guatemala',
    allDay: false,
    clientDpi: '1000000000001',
    clientName: 'Ana Cliente',
    caseId: null,
    location: 'Oficina',
    status: 'SCHEDULED',
    version: 0,
    syncState: 'SYNCED',
  }
  const rows = Array.from({ length: 26 }, (_, index) => ({
    ...fixture,
    id: index + 1,
    title: 'Consulta ' + (index + 1),
    startsAt: new Date(now.getTime() + index * 600000).toISOString(),
    endsAt: new Date(now.getTime() + index * 600000 + 300000).toISOString(),
  }))
  rows[0] = fixture
  let googleConnected = true
  const connections = []
  let external = {
    id: 'external1',
    title: 'Actividad desde Google',
    description: 'Texto público',
    startsAt: new Date(now.getTime() + 300000).toISOString(),
    endsAt: new Date(now.getTime() + 1800000).toISOString(),
    timeZone: 'America/Guatemala',
    allDay: false,
    etag: 'tag',
    status: 'confirmed',
    recurrence: [],
    editable: true,
    hasGuests: false,
    localEventId: null,
    linkedConflict: false,
    calendarUrl: 'https://calendar.google.com/calendar/u/0/r',
  }
  function googleState() {
    if (googleConnected) return 'CONNECTED'
    return 'DISCONNECTED'
  }
  const linked = {
    ...external,
    id: 'legal1',
    title: 'Referencia pública',
    startsAt: fixture.startsAt,
    endsAt: fixture.endsAt,
    localEventId: 1,
  }
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      endpoint = url.pathname
    requested.push(endpoint)
    if (endpoint.endsWith('/users'))
      return route.fulfill({
        json: [
          {
            email: 'abogada@system.com',
            dpi: '3002234560901',
            firstName: 'Ana',
            lastName: 'Gómez',
            role: 'Abogada',
          },
        ],
      })
    if (endpoint.endsWith('/agenda/google/status'))
      return route.fulfill({
        json: {
          enabled: true,
          state: googleState(),
          canManage: true,
          accountEmail: 'office@example.test',
          pendingCount: 0,
        },
      })
    if (endpoint.endsWith('/agenda/google/intent')) return route.fulfill({ json: { state: 'test-intent' } })
    if (endpoint.endsWith('/agenda/google/connect')) {
      connections.push(req.postDataJSON())
      googleConnected = true
      return route.fulfill({
        json: { state: 'CONNECTED', enabled: true, canManage: true, accountEmail: 'office@example.test' },
      })
    }
    if (endpoint.endsWith('/agenda/calendar')) return route.fulfill({ json: rows })
    if (endpoint.endsWith('/agenda/google/events')) {
      if (url.searchParams.has('pageToken'))
        return route.fulfill({ json: { items: [linked], nextPageToken: null, checkedAt: now.toISOString() } })
      return route.fulfill({
        json: { items: [external], nextPageToken: 'second', checkedAt: now.toISOString() },
      })
    }
    if (endpoint.endsWith('/agenda/google/events/external1')) {
      if (req.method() === 'PUT') {
        const payload = req.postDataJSON()
        edits.push(payload)
        external = { ...external, ...payload, recurrence: [], etag: 'new-tag' }
      }
      return route.fulfill({ json: external })
    }
    if (endpoint.endsWith('/agenda/upcoming'))
      return route.fulfill({ json: { content: [fixture], totalElements: 1, totalPages: 1 } })
    if (endpoint.endsWith('/agenda/events') && req.method() === 'POST') {
      const payload = req.postDataJSON()
      created.push(payload)
      return route.fulfill({ status: 201, json: { ...fixture, ...payload, id: 30, version: 0 } })
    }
    if (endpoint.endsWith('/agenda/events/1/history'))
      return route.fulfill({
        json: [
          {
            action: 'CREATED',
            operatorName: 'Ana Gómez',
            version: 0,
            recordedAt: now.toISOString(),
            startsAt: fixture.startsAt,
            endsAt: fixture.endsAt,
          },
        ],
      })
    if (endpoint.endsWith('/agenda/events/1')) return route.fulfill({ json: fixture })
    if (endpoint.endsWith('/clients/search'))
      return route.fulfill({
        json: {
          content: [{ dpi: '1000000000001', firstName: 'Ana', lastName: 'Cliente', active: true }],
          totalPages: 1,
          totalElements: 1,
          page: 0,
          size: 5,
        },
      })
    return route.fulfill({ json: { content: [], totalPages: 0, totalElements: 0 } })
  })
  await page.goto(`http://127.0.0.1:${server.address().port}/agenda`)
  await page.getByRole('heading', { name: 'Agenda', exact: true }).waitFor()
  await page.locator('.calendar button[aria-current="date"]:not(:disabled)').waitFor()
  await page.screenshot({ path: `/tmp/agenda-overview-${width}-${theme}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Ver listado', exact: true }).click()
  try {
    await page
      .getByRole('button', { name: /Actividad desde Google/ })
      .first()
      .waitFor({ timeout: 10000 })
  } catch (error) {
    console.log({ requested, errors, body: await page.locator('body').innerText() })
    await page.screenshot({ path: '/tmp/agenda-browser-error.png', fullPage: true })
    throw error
  }
  assert.equal(await page.locator('.event-list li').count(), 25)
  assert.equal(await page.locator('.event-list').getByText('Referencia pública', { exact: true }).count(), 0)
  assert.equal(
    await page.locator('html').evaluate((element) => element.scrollWidth > innerWidth + 1),
    false,
    `desbordamiento mensual ${width} ${theme}`,
  )
  await page.screenshot({ path: `/tmp/agenda-month-${width}-${theme}.png`, fullPage: true })
  console.log('Resumen del día: abrir, detalle, teclado y fecha vacía')
  const todayButton = page.locator('.calendar button[aria-current="date"]')
  await todayButton.click()
  const dayDialog = page.getByRole('dialog').filter({ has: page.locator('#agenda-day-title') })
  await dayDialog.locator('.day-event').first().waitFor()
  assert.equal(await dayDialog.getByRole('button', { name: /Consulta de prueba/ }).count(), 1)
  assert.equal(await dayDialog.getByRole('button', { name: /Actividad desde Google/ }).count(), 1)
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
  assert.equal(await dayDialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1), false)
  assert.equal(await dayDialog.locator('.day-footer').evaluate((element) => element.getBoundingClientRect().bottom <= innerHeight + 1), true, 'acciones del día visibles sin recorrer toda la lista')
  await page.screenshot({ path: `/tmp/agenda-day-${width}-${theme}.png`, fullPage: false, animations: 'disabled' })
  await dayDialog.getByRole('button', { name: /Consulta de prueba/ }).click()
  await page.getByRole('heading', { name: 'Historial', exact: true }).waitFor()
  await dayDialog.waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('dialog').count(), 1)
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()
  await todayButton.click()
  await dayDialog.getByRole('button', { name: 'Cerrar actividades del día', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await dayDialog.waitFor({ state: 'hidden' })
  assert.equal(await todayButton.evaluate((element) => element === document.activeElement), true)
  const emptyDay = page.locator('.calendar button').filter({ hasNot: page.locator('.activity-count') }).first()
  const emptyDate = await emptyDay.getAttribute('data-date')
  await emptyDay.click()
  await dayDialog.getByRole('heading', { name: 'Un espacio libre en tu agenda' }).waitFor()
  await dayDialog.getByRole('button', { name: 'Agendar este día', exact: true }).click()
  const dayForm = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nueva actividad', exact: true }) })
  await dayForm.getByLabel('Inicio *', { exact: true }).waitFor()
  assert.equal((await dayForm.getByLabel('Inicio *', { exact: true }).inputValue()).slice(0, 10), emptyDate)
  await dayDialog.waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('dialog').count(), 1)
  await dayForm.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Hoy', exact: true }).click()
  console.log('Cambiar a semana')
  await page.getByLabel('Vista del calendario').getByRole('button', { name: 'Semana', exact: true }).click()
  await page.locator('.week-view').waitFor()
  assert.equal(
    await page.locator('html').evaluate((element) => element.scrollWidth > innerWidth + 1),
    false,
    `desbordamiento semanal ${width} ${theme}`,
  )
  await page.screenshot({ path: `/tmp/agenda-week-${width}-${theme}.png`, fullPage: true })
  console.log('Editar externo')
  await page
    .getByRole('button', { name: /Actividad desde Google/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Editar evento de Google', exact: true }).click()
  const foreignDialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: 'Editar evento de Google', exact: true }) })
  await foreignDialog.getByRole('textbox', { name: 'Título *', exact: true }).fill('Google actualizado')
  await foreignDialog.getByRole('button', { name: 'Guardar en Google', exact: true }).click()
  await foreignDialog.waitFor({ state: 'hidden' })
  assert.equal(edits.length, 1)
  assert.equal(edits[0].etag, 'tag')
  assert.equal(edits[0].scope, 'ONE')
  await page
    .locator('.event-list')
    .getByRole('button', { name: /Google actualizado/ })
    .click()
  await page.getByRole('button', { name: 'Editar evento de Google', exact: true }).click()
  assert.equal(
    await foreignDialog.getByRole('button', { name: 'Guardar en Google', exact: true }).isEnabled(),
    true,
  )
  await foreignDialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
  console.log('Formulario local')
  await page.getByRole('button', { name: 'Nueva actividad', exact: true }).click()
  const dialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: 'Nueva actividad', exact: true }) })
  await dialog.getByRole('textbox', { name: 'Título *', exact: true }).fill('Nueva consulta')
  const tomorrow = new Date(day + 'T12:00:00Z')
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  await dialog.getByLabel('Inicio *', { exact: true }).fill(tomorrow.toISOString().slice(0, 10) + 'T09:00')
  await dialog.getByLabel('Fin *', { exact: true }).fill(tomorrow.toISOString().slice(0, 10) + 'T10:00')
  await dialog.getByRole('combobox', { name: 'Repetición', exact: true }).selectOption('WEEKLY')
  const until = new Date(day + 'T12:00:00Z')
  until.setUTCDate(until.getUTCDate() + 28)
  await dialog.getByLabel('Repetir hasta *', { exact: true }).fill(until.toISOString().slice(0, 10))
  await dialog.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await dialog.getByRole('button', { name: 'Guardar actividad', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(created.length, 1)
  assert.equal(created[0].clientDpi, '1000000000001')
  assert.equal(created[0].recurrence.frequency, 'WEEKLY')
  assert.match(created[0].requestId, /^[a-f0-9-]{36}$/)
  await page.getByRole('button', { name: 'Nueva actividad', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Título *', exact: true }).waitFor()
  assert.equal(await dialog.getByRole('textbox', { name: 'Título *', exact: true }).inputValue(), '')
  assert.equal(await dialog.getByRole('combobox', { name: 'Repetición', exact: true }).inputValue(), '')
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page
    .getByRole('button', { name: /Consulta de prueba/ })
    .first()
    .click()
  await page.getByRole('heading', { name: 'Historial', exact: true }).waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()
  googleConnected = false
  await page.getByRole('button', { name: 'Actualizar conexión', exact: true }).click()
  await page.evaluate(() => {
    window.google = {
      accounts: {
        oauth2: {
          initCodeClient: (config) => ({
            requestCode: () => config.callback({ code: 'one-time-code', state: config.state }),
          }),
        },
      },
    }
  })
  await page.getByRole('button', { name: 'Conectar Google', exact: true }).click()
  await page.getByRole('button', { name: 'Autorizar Google', exact: true }).click()
  await page.getByRole('button', { name: 'Desconectar', exact: true }).waitFor()
  assert.deepEqual(connections, [{ code: 'one-time-code', state: 'test-intent' }])
  assert.deepEqual(errors, [])
  await context.close()
}
;(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of (process.env.AGENDA_TEST_WIDTHS || '390,768,1440').split(',').map(Number))
      for (const theme of ['light', 'dark']) await scenario(browser, width, theme)
    console.log(
      'Escenarios completados: calendario, modal diario, fecha vacía, teclado, listado, Google, edición, recurrencia y temas: OK',
    )
  } finally {
    await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }
})().catch((error) => {
  console.error(error)
  server.close()
  process.exitCode = 1
})
