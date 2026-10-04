const types = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }

export function documentFileError(file, policy) {
  if (!policy) return 'No se ha podido consultar el límite de archivos. Reintenta la carga.'
  const extension = file.name.split('.').pop().toLowerCase()
  if (!policy.extensions.includes(extension) || !types[extension]) return 'Solo se permiten PDF, JPG y PNG.'
  if (file.type && file.type !== 'application/octet-stream' && file.type !== types[extension]) {
    return 'El tipo de archivo no coincide con su extensión.'
  }
  if (!file.size) return 'El archivo está vacío.'
  if (file.size > policy.maxFileSize) return `El archivo supera el límite de ${formatFileSize(policy.maxFileSize)}.`
  if (file.name.length > 180 || /[\u0000-\u001f\u007f-\u009f]/u.test(file.name)) return 'El nombre debe tener hasta 180 caracteres, sin caracteres de control.'
  return ''
}

// Un rechazo del servidor (4xx) no mejora reenviando los mismos bytes: el archivo
// debe volver a seleccionarse o el documento volver a adjuntarse. Los errores de red
// o del servidor (5xx) sí son reintentables.
export function isPermanentError(error) {
  const status = Number(error?.status ?? 0)
  if (!status || status < 400) return false
  if (status === 408 || status === 429) return false
  return status < 500
}

// Etiqueta corta para identificar el tipo de archivo en la lista de documentos.
export function documentExtension(name = '') {
  const parts = String(name).split('.')
  const extension = parts.length > 1 ? parts.pop().trim().toUpperCase() : ''
  return extension || 'ARCHIVO'
}

export function isImageDocument(document) {
  return String(document?.contentType || '').startsWith('image/')
}

export function formatFileSize(size) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`
  return `${(size / (1024 * 1024)).toFixed(1)} MiB`
}
