const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(process.env.DASHBOARD_DIST || path.join(__dirname, '../../dist'))
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname)
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403)
    res.end()
    return
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(root, 'index.html')
  }
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html' }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
  res.end(fs.readFileSync(file))
})
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date())
const start = new Date(date + 'T16:00:00Z').toISOString()
const activity = {
  id: 1,
  title: 'Consulta con cliente',
  type: 'APPOINTMENT',
  startsAt: start,
  endsAt: new Date(Date.parse(start) + 3600000).toISOString(),
  timeZone: 'America/Guatemala',
  allDay: false,
  caseId: 9,
  caseCode: 'EXP-9',
  originalStartsAt: null,
}
const reminder = {
  kind: 'TODAY',
  activity: { ...activity, id: 2, type: 'PAYMENT_REMINDER', title: 'Llamar por el abono acordado' },
}
const summary = {
  generatedAt: new Date().toISOString(),
  date,
  timeZone: 'America/Guatemala',
  activeCases: 103,
  todayActivities: 2,
  agenda: [activity, reminder.activity],
  reminders: { today: 1, upcoming: 2, unattended: 1 },
  reminderPreview: [reminder],
  unattendedFrom: date,
  upcomingThrough: date,
  week: Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date + 'T12:00:00Z')
    day.setUTCDate(day.getUTCDate() + index)
    return { date: day.toISOString().slice(0, 10), count: index + 1 }
  }),
}
const user = {
  email: 'abogada@system.com',
  dpi: '3002234560901',
  firstName: 'Ana',
  lastName: 'Gómez',
  role: 'Abogada',
}
const tokens = { ...user, accessToken: 'test-token', refreshToken: 'test-refresh' }
async function contextFor(browser, width, theme, session = true) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    timezoneId: 'America/Guatemala',
    reducedMotion: 'reduce',
  })
  await context.addInitScript(
    ({ theme, session, user }) => {
      localStorage.setItem('legal-administrator-theme', theme)
      if (session) {
        localStorage.setItem('accessToken', 'test-token')
        localStorage.setItem('refreshToken', 'test-refresh')
        localStorage.setItem('authUser', JSON.stringify(user))
      }
    },
    { theme, session, user },
  )
  return context
}
async function mock(page, flags) {
  await page.route('https://accounts.google.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url()),
      endpoint = url.pathname
    if (endpoint.endsWith('/auth/login')) {
      if (flags.twoFactor) {
        return route.fulfill({ json: { twoFactorRequired: true, email: user.email } })
      }
      return route.fulfill({ json: tokens })
    }
    if (endpoint.endsWith('/auth/2fa/verify')) {
      return route.fulfill({ json: tokens })
    }
    if (endpoint.endsWith('/dashboard/summary')) {
      if (flags.failSummary) {
        return route.fulfill({ status: 503, json: { message: 'no disponible' } })
      }
      return route.fulfill({ json: summary })
    }
    if (endpoint.endsWith('/dashboard/reminders')) {
      const number = Number(url.searchParams.get('page') || 0)
      const kind = url.searchParams.get('kind') || 'TODAY'
      const content = Array.from({ length: 15 }, (_, index) => ({
        kind,
        activity: { ...reminder.activity, id: index + 2, title: 'Recordatorio ' + (index + 1) },
      })).slice(number * 10, (number + 1) * 10)
      return route.fulfill({
        json: {
          generatedAt: summary.generatedAt,
          date,
          unattendedFrom: date,
          upcomingThrough: date,
          reminders: { content, page: number, size: 10, totalElements: 15, totalPages: 2 },
        },
      })
    }
    if (endpoint.endsWith('/agenda/google/status')) {
      return route.fulfill({
        json: { enabled: true, state: 'CONNECTED', canManage: true, accountEmail: 'office@example.test' },
      })
    }
    if (endpoint.endsWith('/agenda/google/events')) {
      if (flags.failGoogle) {
        return route.fulfill({ status: 503, json: { message: 'Google no disponible' } })
      }
      return route.fulfill({
        json: {
          items: [
            { ...activity, id: 'linked', localEventId: 1, title: 'Referencia pública' },
            {
              ...activity,
              id: 'foreign',
              localEventId: null,
              title: 'Reunión externa',
              editable: true,
              calendarUrl: 'https://calendar.google.com/',
            },
          ],
          nextPageToken: null,
          checkedAt: summary.generatedAt,
        },
      })
    }
    if (endpoint.endsWith('/agenda/calendar')) {
      return route.fulfill({
        json: [activity, reminder.activity].map((item) => ({
          ...item,
          status: 'SCHEDULED',
          version: 0,
          syncState: 'LOCAL',
        })),
      })
    }
    if (endpoint.endsWith('/agenda/events/1/history')) {
      return route.fulfill({ json: [] })
    }
    if (endpoint.endsWith('/agenda/events/1')) {
      return route.fulfill({ json: { ...activity, status: 'SCHEDULED', version: 0, syncState: 'LOCAL' } })
    }
    return route.fulfill({ json: { content: [], page: 0, size: 12, totalPages: 0, totalElements: 0 } })
  })
}
async function scenario(browser, width, theme) {
  console.log('Dashboard', width, theme)
  const context = await contextFor(browser, width, theme),
    page = await context.newPage(),
    errors = []
  page.setDefaultTimeout(10000)
  page.on('pageerror', (error) => errors.push(error.message))
  const flags = { failGoogle: false, failSummary: false, twoFactor: false }
  await mock(page, flags)
  const origin = `http://127.0.0.1:${server.address().port}`
  await page.goto(origin + '/app')
  await page.waitForURL('**/inicio')
  try {
    await page.getByRole('heading', { name: /Hola, Ana/ }).waitFor()
  } catch (error) {
    console.log('Vista:', await page.locator('body').innerText())
    console.log('Errores:', errors)
    throw error
  }
  await page.locator('.google-list').getByText('Reunión externa').waitFor()
  assert.equal(await page.locator('.stat-link').count(), 4)
  assert.equal(await page.locator('.stat-value').first().innerText(), '103')
  assert.equal(await page.locator('.google-list').getByText('Referencia pública').count(), 0)
  assert.equal(await page.locator('html').evaluate((el) => el.scrollWidth > innerWidth + 1), false)
  assert.equal(await page.getByText('Saldo pendiente', { exact: true }).count(), 0)
  await page.screenshot({
    path: `/tmp/dashboard-${width}-${theme}.png`,
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Ver todos los recordatorios', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Recordatorio 1 / }).waitFor()
  assert.equal(await dialog.locator('li').count(), 10)
  await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await dialog.getByRole('button', { name: /Recordatorio 11/ }).waitFor()
  assert.equal(await dialog.locator('li').count(), 5)
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  flags.failGoogle = true
  await page.getByRole('button', { name: 'Actualizar resumen', exact: true }).click()
  await page.getByRole('button', { name: 'Reintentar Google Calendar', exact: true }).waitFor()
  assert.equal(await page.locator('.stat-value').first().innerText(), '103')
  const closeToast = page.getByRole('button', { name: 'Cerrar notificación', exact: true })
  if (await closeToast.count()) {
    await closeToast.click()
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  flags.failSummary = true
  await page.getByRole('button', { name: 'Actualizar resumen', exact: true }).click()
  await page.getByText(/Última información disponible/).waitFor()
  assert.equal(await page.locator('.stat-value').first().innerText(), '103')
  flags.failSummary = false
  flags.failGoogle = false
  await page
    .locator('.daily-timeline')
    .getByRole('link', { name: /Consulta con cliente/ })
    .click()
  await page.waitForURL(/agenda.*activity=1/)
  await page.getByRole('dialog').getByRole('heading', { name: 'Consulta con cliente', exact: true }).waitFor()
  assert.match(page.url(), new RegExp('day=' + date))
  await page.goto(origin + '/inicio?reminders=TODAY')
  await page.getByRole('dialog').getByRole('button', { name: /Recordatorio 1 / }).waitFor()
  assert.deepEqual(errors, [])
  await context.close()
}
async function loginScenario(browser, twoFactor, target) {
  const context = await contextFor(browser, 390, 'light', false),
    page = await context.newPage()
  await mock(page, { twoFactor })
  const origin = `http://127.0.0.1:${server.address().port}`
  let path = '/login'
  if (target) {
    path += '?redirect=' + encodeURIComponent(target)
  }
  await page.goto(origin + path)
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  if (twoFactor) {
    await page.waitForURL(/verificacion/)
    const inputs = page.locator('.otp-inputs input')
    for (let i = 0; i < 6; i++) {
      await inputs.nth(i).fill(String(i + 1))
    }
    await page.getByRole('button', { name: 'Verificar y continuar', exact: true }).click()
  }
  let expected = '/inicio'
  if (target) {
    expected = target
  }
  await page.waitForURL(origin + expected)
  await context.close()
  console.log('Login validado', twoFactor, expected)
}
;(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of (process.env.DASHBOARD_WIDTHS || '390,768,1440').split(',').map(Number)) {
      for (const theme of ['light', 'dark']) {
        await scenario(browser, width, theme)
      }
    }
    if (process.env.DASHBOARD_LOGIN === 'true') {
      await loginScenario(browser, false)
      await loginScenario(browser, true)
      await loginScenario(browser, true, '/agenda')
    }
    console.log('Dashboard: visualización, filtros, paginación, fallos parciales y acceso a Agenda: OK')
  } finally {
    await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
