export function queryString(filters = {}) {
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') continue
    query.set(name, String(value))
  }
  const encoded = query.toString()
  if (!encoded) return ''
  return '?' + encoded
}

export function expectPage(value) {
  if (!Array.isArray(value?.content) || !Number.isInteger(value?.totalPages)
      || !Number.isInteger(value?.totalElements) || value.totalElements < 0) {
    throw new Error('El servidor no devolvió un listado paginado válido.')
  }
  return value
}
