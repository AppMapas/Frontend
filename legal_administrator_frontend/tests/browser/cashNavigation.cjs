const { chromium } = require('playwright')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const root = path.resolve(process.env.CASH_FRONTEND_DIST || '/tmp/h09-nav-dist')
const account = { email: 'abogada@system.com', firstName: 'Ana', lastName: 'Gómez', role: 'Abogada' }
const profile = { ...account, dpi: '3002234560901' }
const key = 'legal-cash-pending-v1'
const pending = { actor: profile.dpi, endpoint: '/cash/expenses', kind: 'cash', payload: {
  requestId: '11111111-1111-4111-8111-111111111111', category: 'UTILES_OFICINA',
  amount: '10.00', description: 'Papel de prueba', date: '2020-01-01', paymentMethod: 'EFECTIVO', reference: null,
} }
const overview = { summary: { income: '0.00', officeExpenses: '0.00', personalExpenses: '0.00', officeBalance: '0.00', generalBalance: '0.00', currency: 'GTQ' }, movements: { content: [], page: 0, size: 12, totalElements: 0, totalPages: 0 } }
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html' }
const server = http.createServer((request, response) => {
  let file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname)
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  response.end(fs.readFileSync(file))
})

async function scenario(browser, config, options = {}) {
  const context = await browser.newContext({ viewport: config, reducedMotion: 'reduce', timezoneId: 'America/Guatemala' })
  let user = account
  if (options.knownDpi) user = profile
  await context.addInitScript(({ user, pending, key, theme }) => {
    localStorage.setItem('accessToken', 'test-token')
    localStorage.setItem('refreshToken', 'test-refresh')
    localStorage.setItem('authUser', JSON.stringify(user))
    localStorage.setItem('legal-administrator-theme', theme)
    if (pending) sessionStorage.setItem(key, JSON.stringify(pending))
  }, { user, pending: options.pending, key, theme: options.theme || 'light' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Chromium registra también los estados HTTP simulados intencionalmente.
    if (options.profileFails && text.includes('server responded with a status of 503')) return
    if (options.expired && text.includes('server responded with a status of 401')) return
    errors.push(text)
  })
  let releaseProfile = null
  let profileFails = !!options.profileFails
  let usersRequests = 0
  let cashRequests = 0
  let refreshRequests = 0
  const submitted = []
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const endpoint = new URL(request.url()).pathname
    if (endpoint.endsWith('/users')) {
      usersRequests += 1
      if (options.holdProfile && usersRequests === 1) await new Promise(resolve => { releaseProfile = resolve })
      if (profileFails) return route.fulfill({ status: 503, json: { message: 'Perfil no disponible para esta prueba.' } })
      return route.fulfill({ json: [profile] })
    }
    if (endpoint.endsWith('/auth/refresh')) {
      refreshRequests += 1
      return route.fulfill({ json: { ...account, accessToken: 'new-token', refreshToken: 'test-refresh' } })
    }
    if (endpoint.endsWith('/cash')) {
      cashRequests += 1
      if (options.expired && cashRequests === 1) return route.fulfill({ status: 401, json: { message: 'Token de prueba vencido.' } })
      return route.fulfill({ json: overview })
    }
    if (endpoint.endsWith('/cash/expenses') && request.method() === 'POST') {
      submitted.push(request.postDataJSON())
      return route.fulfill({ status: 201, json: { source: 'EXPENSE', sourceId: '5', replayed: false, caseVersion: null } })
    }
    if (endpoint.endsWith('/legal-processes')) return route.fulfill({ json: { content: [], page: 0, size: 6, totalElements: 0, totalPages: 0 } })
    errors.push('Endpoint no esperado: ' + endpoint)
    return route.fulfill({ status: 404, json: { message: 'Endpoint no simulado.' } })
  })

  async function navigate(label) {
    const desktop = page.getByRole('navigation', { name: 'Navegación principal', exact: true })
    if (await desktop.isVisible()) {
      await desktop.getByRole('link', { name: label, exact: true }).click()
      return
    }
    await page.getByRole('button', { name: 'Abrir menú de navegación', exact: true }).click()
    await page.getByRole('navigation', { name: 'Navegación móvil', exact: true }).getByRole('link', { name: label, exact: true }).click()
  }
  async function dismissToast() {
    const close = page.getByRole('button', { name: 'Cerrar notificación', exact: true })
    if (await close.count()) await close.click()
  }
  try {
    let initialRoute = '/historial'
    await page.goto('http://127.0.0.1:55440' + initialRoute)
    if (options.profileFails) {
      await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor()
      await dismissToast()
    }
    if (initialRoute !== '/caja') await navigate('Caja')
    await page.getByRole('heading', { name: 'Caja', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Movimientos', exact: true }).waitFor()
    const register = page.getByRole('button', { name: 'Registrar movimiento', exact: true })
    if (options.holdProfile) {
      assert.equal(await register.isDisabled(), true)
      assert.equal(await page.getByRole('heading', { name: 'Hay un registro pendiente de confirmar', exact: true }).count(), 0)
      assert.ok(releaseProfile)
      releaseProfile()
    }
    if (options.profileFails) {
      await page.getByRole('button', { name: 'Reintentar cargar cuenta', exact: true }).waitFor()
      assert.equal(await register.isDisabled(), true)
      profileFails = false
      await page.getByRole('button', { name: 'Reintentar cargar cuenta', exact: true }).click()
    }
    if (options.pending) {
      await page.getByRole('heading', { name: 'Hay un registro pendiente de confirmar', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Resolver registro pendiente', exact: true }).click()
      await page.getByRole('button', { name: 'Reintentar mismo registro', exact: true }).click()
      await page.getByText('Movimiento registrado correctamente.', { exact: true }).waitFor()
      assert.equal(submitted.length, 1)
      assert.deepEqual(submitted[0], pending.payload)
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), null)
    } else {
      await register.waitFor()
      await page.waitForFunction(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.some(button => button.textContent.trim() === 'Registrar movimiento' && !button.disabled)
      })
      assert.equal(await page.getByRole('heading', { name: 'Hay un registro pendiente de confirmar', exact: true }).count(), 0)
      await page.screenshot({ path: '/tmp/h09-caja-navigation-' + config.width + '-' + (options.theme || 'light') + '.png', fullPage: true })
      await register.click()
      await page.locator('#cash-category').selectOption('UTILES_OFICINA')
      await page.locator('#cash-amount').fill('10.00')
      await page.locator('#cash-description').fill('Papel de prueba')
      await page.getByRole('button', { name: 'Revisar movimiento', exact: true }).click()
      await page.getByRole('button', { name: 'Confirmar y guardar', exact: true }).click()
      await page.getByText('Movimiento registrado correctamente.', { exact: true }).waitFor()
      assert.equal(submitted.length, 1)
      assert.equal(submitted[0].amount, '10.00')
      assert.equal(submitted[0].category, 'UTILES_OFICINA')
    }
    await page.getByRole('heading', { name: 'Registrar movimiento', exact: true }).waitFor({ state: 'hidden' })
    await dismissToast()
    await navigate('Reportes')
    await page.waitForURL('**/reportes')
    assert.equal(await page.getByRole('heading', { name: '¿Salir de este formulario?', exact: true }).count(), 0)
    await navigate('Caja')
    await page.getByRole('heading', { name: 'Movimientos', exact: true }).waitFor()
    assert.equal(await register.isDisabled(), false)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
    if (options.knownDpi) assert.equal(usersRequests, 0)
    else if (options.profileFails) assert.equal(usersRequests, 2)
    else assert.equal(usersRequests, 1)
    if (options.expired) assert.equal(refreshRequests, 1)
    console.log('PASS', JSON.stringify({ width: config.width, theme: options.theme || 'light', ...options, pending: !!options.pending }))
  } finally {
    releaseProfile?.()
    await context.close()
  }
}

async function main() {
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'Compila el frontend y configura CASH_FRONTEND_DIST antes de ejecutar esta prueba.')
  await new Promise(resolve => server.listen(55440, '127.0.0.1', resolve))
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    for (const width of [390, 768, 1440]) {
      for (const theme of ['light', 'dark']) await scenario(browser, { width, height: 1000 }, { holdProfile: true, theme })
    }
    await scenario(browser, { width: 390, height: 1000 }, { profileFails: true })
    await scenario(browser, { width: 1440, height: 1000 }, { knownDpi: true, pending, expired: true })
    await scenario(browser, { width: 390, height: 1000 }, { pending, holdProfile: true })
  } finally {
    await browser.close()
    server.close()
  }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1 })
