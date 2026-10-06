import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { configureHttpClientAuth } from '../src/shared/api/httpClient.js'
import { interceptAuthResponse, mapAuthUser, readPersistedAuthSession } from '../src/shared/auth/authSessionStorage.js'

// Resuelve los mismos alias de Vite para ejercitar la store real en Node.
const srcRoot = new URL('../src/', import.meta.url)
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    let resolved = specifier
    if (specifier.startsWith('@/')) resolved = new URL(specifier.slice(2), srcRoot).href
    else if (specifier.startsWith('.') && context.parentURL) resolved = new URL(specifier, context.parentURL).href
    if (resolved.startsWith('file:') && existsSync(new URL(resolved + '.js'))) resolved += '.js'
    return nextResolve(resolved, context)
  },
})
const { useAuthStore } = await import('../src/modules/auth/stores/authStore.js')
hooks.deregister()

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const account = { email: 'abogada@system.com', firstName: 'Ana', lastName: 'Gómez', role: 'Abogada' }
const profile = { ...account, dpi: '3002234560901', age: 34, nationalityName: 'Guatemalteca' }
const tokens = { ...account, accessToken: 'test-token', refreshToken: 'test-refresh' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('Identidad de sesión usada por Caja', () => {
  beforeEach(() => {
    const entries = new Map()
    globalThis.window = { localStorage: {
      getItem: key => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: key => entries.delete(key),
    } }
    setActivePinia(createPinia())
    configureHttpClientAuth({ getAccessToken: () => 'test-token', canRefresh: () => false, logout: null })
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
    configureHttpClientAuth({ getAccessToken: () => null, canRefresh: () => false, logout: null })
  })

  test('conserva el perfil de la misma cuenta y toma el rol nuevo del servidor', () => {
    const updated = mapAuthUser({ ...tokens, role: 'Administrador' }, profile)
    assert.equal(updated.dpi, profile.dpi)
    assert.equal(updated.nationalityName, profile.nationalityName)
    assert.equal(updated.role, 'Administrador')
    assert.equal(mapAuthUser({ ...tokens, email: 'otra@system.com' }, profile).dpi, undefined)
  })

  test('login sin DPI se completa con el perfil autenticado sin visitar Perfil', async () => {
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/auth/login')) return json(tokens)
      assert.match(url, /\/users$/)
      assert.equal(options.headers.get('Authorization'), 'Bearer test-token')
      return json([{ ...profile, email: 'otra@system.com', dpi: '3001123450101' }, profile])
    }
    const auth = useAuthStore()
    await auth.login({ email: account.email, password: 'test-only' })
    assert.equal(auth.user.dpi, undefined)
    await auth.loadCurrentUser()
    assert.equal(auth.user.dpi, profile.dpi)
    assert.equal(readPersistedAuthSession().user.dpi, profile.dpi)
    assert.equal(auth.isProfileLoading, false)
  })

  test('la renovación conserva DPI en memoria y en la sesión persistida', async () => {
    const auth = useAuthStore()
    auth.setSession({ ...tokens, ...profile })
    globalThis.fetch = async url => {
      assert.match(url, /\/auth\/refresh$/)
      return json({ ...tokens, accessToken: 'new-token' })
    }
    await auth.refreshSession()
    assert.equal(auth.user.dpi, profile.dpi)
    assert.equal(auth.accessToken, 'new-token')
    assert.equal(readPersistedAuthSession().user.dpi, profile.dpi)
  })

  test('el interceptor tampoco elimina la identidad cuando renueva tokens', () => {
    useAuthStore().setSession({ ...tokens, ...profile })
    interceptAuthResponse({ ...tokens, accessToken: 'new-token' })
    assert.equal(readPersistedAuthSession().user.dpi, profile.dpi)
    interceptAuthResponse({ ...tokens, email: 'otra@system.com' })
    assert.equal(readPersistedAuthSession().user.dpi, undefined)
  })

  test('descarta un perfil recibido después de cerrar sesión', async () => {
    const auth = useAuthStore()
    auth.setSession(tokens)
    let release
    globalThis.fetch = async () => new Promise(resolve => { release = resolve })
    const loading = auth.loadCurrentUser()
    auth.logout()
    release(json([profile]))
    assert.equal(await loading, null)
    assert.equal(auth.user, null)
    assert.equal(auth.isAuthenticated, false)
    assert.equal(auth.isProfileLoading, false)
    assert.equal(readPersistedAuthSession(), null)
  })

  test('la respuesta de otra cuenta no sustituye al usuario actual', async () => {
    const auth = useAuthStore()
    auth.setSession(tokens)
    let release
    globalThis.fetch = async () => new Promise(resolve => { release = resolve })
    const loading = auth.loadCurrentUser()
    auth.setSession({ ...tokens, email: 'otra@system.com', role: 'Administrador' })
    release(json([profile]))
    assert.equal(await loading, null)
    assert.equal(auth.user.email, 'otra@system.com')
    assert.equal(auth.user.dpi, undefined)
    assert.equal(auth.isProfileLoading, false)
  })

  test('una consulta antigua no revierte un perfil más reciente', async () => {
    const auth = useAuthStore()
    auth.setSession(tokens)
    const releases = []
    globalThis.fetch = async () => new Promise(resolve => releases.push(resolve))
    const first = auth.loadCurrentUser()
    const second = auth.loadCurrentUser()
    releases[1](json([{ ...profile, role: 'Administrador' }]))
    await second
    releases[0](json([profile]))
    assert.equal(await first, null)
    assert.equal(auth.user.role, 'Administrador')
    assert.equal(auth.isProfileLoading, false)
  })

  test('un perfil incompleto requiere reintento y no habilita identidad inventada', async () => {
    const auth = useAuthStore()
    auth.setSession(tokens)
    globalThis.fetch = async () => json([account])
    await assert.rejects(auth.loadCurrentUser(), /no confirmó el DPI/)
    assert.equal(auth.user.dpi, undefined)
    assert.equal(auth.isProfileLoading, false)
    globalThis.fetch = async () => json([profile])
    await auth.loadCurrentUser()
    assert.equal(auth.user.dpi, profile.dpi)
    assert.equal(auth.profileError, null)
  })

  test('el perfil se selecciona por el sujeto del token autenticado', async () => {
    const auth = useAuthStore()
    const jwt = 'header.' + Buffer.from(JSON.stringify({ sub: account.email })).toString('base64url') + '.signature'
    auth.setSession({ ...tokens, email: 'incorrecta@system.com', accessToken: jwt })
    globalThis.fetch = async () => json([profile, { ...profile, email: 'incorrecta@system.com', dpi: '3001123450101' }])
    await auth.loadCurrentUser()
    assert.equal(auth.user.email, account.email)
    assert.equal(auth.user.dpi, profile.dpi)
  })
})
