export function emptyClient() {
  return {
    dpi: '', firstName: '', lastName: '', email: '', phone: '', birthDate: '',
    maritalStatusId: '', nationalityId: '', occupation: '', exactAddress: '', municipalityId: '',
  }
}

export function clientDraft(client = {}) {
  const draft = emptyClient()
  for (const name of Object.keys(draft)) draft[name] = client[name] ?? ''
  return draft
}

function optionalText(value) {
  const normalized = String(value ?? '').trim().normalize('NFC')
  if (!normalized) return null
  return normalized
}

function optionalId(value) {
  if (value === '' || value === null || value === undefined) return null
  return Number(value)
}

export function clientPayload(draft, version = null) {
  const payload = {
    firstName: optionalText(draft.firstName), lastName: optionalText(draft.lastName),
    email: optionalText(draft.email), phone: optionalText(draft.phone),
    birthDate: optionalText(draft.birthDate), maritalStatusId: optionalId(draft.maritalStatusId),
    nationalityId: optionalId(draft.nationalityId), occupation: optionalText(draft.occupation),
    exactAddress: optionalText(draft.exactAddress), municipalityId: optionalId(draft.municipalityId),
  }
  if (version === null) payload.dpi = String(draft.dpi ?? '')
  else payload.version = version
  return payload
}

export function validateClient(draft, editing = false) {
  const errors = {}
  if (!editing && !/^[0-9]{13}$/.test(String(draft.dpi ?? ''))) {
    errors.dpi = 'El DPI debe tener exactamente 13 dígitos.'
  }
  for (const [name, label, max] of [
    ['firstName', 'Los nombres', 100], ['lastName', 'Los apellidos', 100],
    ['exactAddress', 'La dirección', 255],
  ]) {
    const value = optionalText(draft[name])
    if (!value || value.length > max) errors[name] = label + ' son obligatorios y admiten hasta ' + max + ' caracteres.'
  }
  const email = optionalText(draft.email) || ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    errors.email = 'Ingresa un correo válido de hasta 100 caracteres.'
  }
  if (!/^\+?[0-9]{8,12}$/.test(String(draft.phone ?? '').trim())) {
    errors.phone = 'El teléfono debe tener entre 8 y 12 dígitos; puede iniciar con +.'
  }
  for (const [name, label] of [['nationalityId', 'la nacionalidad'], ['maritalStatusId', 'el estado civil']]) {
    const id = optionalId(draft[name])
    if (!Number.isSafeInteger(id) || id <= 0) errors[name] = 'Selecciona ' + label + '.'
  }
  if (String(draft.occupation ?? '').length > 150) errors.occupation = 'La ocupación admite hasta 150 caracteres.'
  if (draft.municipalityId !== '' && draft.municipalityId !== null) {
    const id = optionalId(draft.municipalityId)
    if (!Number.isSafeInteger(id) || id <= 0) errors.municipalityId = 'Selecciona un municipio válido.'
  }
  if (draft.birthDate) {
    const now = new Date()
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
    const parsed = new Date(draft.birthDate + 'T00:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate) || Number.isNaN(parsed.getTime())
        || parsed.toISOString().slice(0, 10) !== draft.birthDate || draft.birthDate >= today) {
      errors.birthDate = 'La fecha de nacimiento debe ser válida y anterior a hoy.'
    }
  }
  return errors
}

export function completeClient(client) {
  return Boolean(client?.nationalityId && client?.maritalStatusId && client?.exactAddress?.trim())
}
