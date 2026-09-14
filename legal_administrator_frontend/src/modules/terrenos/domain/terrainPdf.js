import { distance, polygonArea } from './geometry.js'
import { formatSideMeasurements, toSquareVaras } from './units.js'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 42
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const extraWinAnsi = new Map([
  ['€', 128], ['‚', 130], ['ƒ', 131], ['„', 132], ['…', 133], ['†', 134], ['‡', 135],
  ['ˆ', 136], ['‰', 137], ['Š', 138], ['‹', 139], ['Œ', 140], ['Ž', 142],
  ['‘', 145], ['’', 146], ['“', 147], ['”', 148], ['•', 149], ['–', 150], ['—', 151],
  ['˜', 152], ['™', 153], ['š', 154], ['›', 155], ['œ', 156], ['ž', 158], ['Ÿ', 159],
])

// Las fuentes PDF estándar usan WinAnsi. Se conservan tildes, ñ y superíndices;
// los caracteres sin glifo se sustituyen en lugar de escribir UTF-8 incorrecto.
function winAnsi(value) {
  return Array.from(String(value ?? '').normalize('NFC'), (character) => {
    const code = character.codePointAt(0)
    if (code === 9 || code === 10 || code === 13) return ' '
    if (code >= 32 && code <= 126 || code >= 160 && code <= 255) return character
    return String.fromCharCode(extraWinAnsi.get(character) ?? 63)
  }).join('')
}

function literal(value) {
  return `(${winAnsi(value).replace(/[\\()]/g, '\\$&')})`
}

function number(value) {
  if (!Number.isFinite(value)) throw new Error('El plano contiene coordenadas fuera de rango.')
  return value.toFixed(3).replace(/\.?0+$/, '') || '0'
}

const amount = (value) => Number.isFinite(value) ? value.toFixed(2) : 'No disponible'
const bytes = (value) => Uint8Array.from(value, (character) => character.charCodeAt(0))

function textCommand(value, x, y, size = 10, bold = false) {
  return `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${number(x)} ${number(y)} Tm ${literal(value)} Tj ET\n`
}

function wrap(value, width = CONTENT_WIDTH, size = 10) {
  // Helvetica: la anchura máxima de un glifo es inferior a 1.02 em. Este
  // límite conservador mantiene dentro de página incluso DPI y palabras largas.
  const limit = Math.max(1, Math.floor(width / (size * 1.02)))
  const words = String(value ?? '').normalize('NFC').trim().split(/\s+/)
  const lines = []
  let line = ''
  for (let word of words) {
    if (line && line.length + word.length + 1 > limit) {
      lines.push(line)
      line = ''
    }
    while (word.length > limit) {
      lines.push(word.slice(0, limit))
      word = word.slice(limit)
    }
    line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function checkPoints(points) {
  if (!Array.isArray(points) || points.length < 3 || points.some((point) => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
    throw new Error('El reporte necesita un plano con al menos tres vértices válidos.')
  }
}

function polygonPath(points, transform) {
  return points.map((point, index) => {
    const transformed = transform(point)
    return `${number(transformed.x)} ${number(transformed.y)} ${index ? 'l' : 'm'}`
  }).join('\n') + '\nh\n'
}

function drawPlan(vertices, regions) {
  const bounds = vertices.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x), maxX: Math.max(box.maxX, point.x),
    minY: Math.min(box.minY, point.y), maxY: Math.max(box.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const scale = Math.min(390 / (width || 1), 290 / (height || 1))
  const left = (PAGE_WIDTH - width * scale) / 2
  const bottom = 375 + (290 - height * scale) / 2
  const transform = ({ x, y }) => ({ x: left + (x - bounds.minX) * scale, y: bottom + (y - bounds.minY) * scale })
  let content = 'q\n0.1 0.35 0.35 RG 0.94 0.98 0.96 rg 1.5 w\n'
  content += polygonPath(vertices, transform) + 'B\n'
  const colors = ['0.18 0.48 0.65', '0.70 0.38 0.14', '0.40 0.40 0.68', '0.30 0.55 0.30']
  regions.forEach((region, index) => {
    checkPoints(region.points)
    content += `${colors[index % colors.length]} RG 1.2 w [4 2] 0 d\n`
    content += polygonPath(region.points, transform) + 'S\n[] 0 d\n'
    const center = region.points.reduce((point, vertex) => ({ x: point.x + vertex.x / region.points.length, y: point.y + vertex.y / region.points.length }), { x: 0, y: 0 })
    const label = transform(center)
    content += `0.12 0.20 0.22 rg\n${textCommand(`R${index + 1}`, label.x - 7, label.y, 10, true)}`
  })
  content += '0.12 0.20 0.22 rg\n'
  vertices.forEach((point, index) => {
    const next = vertices[(index + 1) % vertices.length]
    const position = transform(point)
    const end = transform(next)
    content += `${number(position.x - 2)} ${number(position.y - 2)} 4 4 re f\n`
    // Muchos lados: las referencias se consultan en el detalle paginado.
    const label = vertices.length <= 12 ? `L${index + 1}: ${amount(distance(point, next))} m` : `L${index + 1}`
    const dx = end.x - position.x
    const dy = end.y - position.y
    const length = Math.hypot(dx, dy) || 1
    const labelX = Math.max(MARGIN, Math.min(PAGE_WIDTH - MARGIN - label.length * 5, (position.x + end.x) / 2 - dy / length * 12 - label.length * 2))
    const labelY = Math.max(344, Math.min(699, (position.y + end.y) / 2 + dx / length * 12))
    content += textCommand(label, labelX, labelY, 8)
    if (vertices.length <= 20) content += textCommand(`P${index + 1}`, position.x + 5, position.y + 5, 8)
  })
  // El eje Y del editor está orientado al norte y se conserva en el PDF.
  content += '0.1 0.35 0.35 RG 1 w 527 657 m 527 694 l S 522 685 m 527 694 l 532 685 l S\n'
  content += textCommand('N', 523, 705, 11, true)
  content += textCommand('L = lado · P = vértice · R = región', MARGIN, 331, 9)
  content += textCommand('Longitudes del dibujo en metros. Las medidas ingresadas figuran en el detalle.', MARGIN, 316, 8)
  return content + 'Q\n'
}

function assemblePdf(pages) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]
  const pageIds = []
  pages.forEach((page, index) => {
    const pageId = objects.length + 1
    const streamId = pageId + 1
    pageIds.push(pageId)
    const content = page + '0.38 0.42 0.44 rg\n' + textCommand(`Plano preliminar · Página ${index + 1} de ${pages.length}`, MARGIN, 27, 8)
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`)
    objects.push(`<< /Length ${bytes(content).length} >>\nstream\n${content}endstream`)
  })
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(output.length)
    output += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = output.length
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => { output += `${String(offset).padStart(10, '0')} 00000 n \n` })
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return bytes(output)
}

export function createTerrainPdfBytes({ terrain = {}, vertices, boundaries = [], regions = [], result, serverRecord = null } = {}) {
  checkPoints(vertices)
  const localArea = polygonArea(vertices)
  if (!Number.isFinite(localArea)) throw new Error('El área del plano excede el rango del reporte.')
  const pages = ['0.12 0.20 0.22 rg\n']
  const add = (command) => { pages[pages.length - 1] += command }
  add(textCommand('Plano del terreno', MARGIN, 793, 20, true))
  const title = String(terrain.terrainName || 'Terreno sin nombre')
  const titleLines = wrap(title, CONTENT_WIDTH - 36, 12)
  add(textCommand(titleLines[0] + (titleLines.length > 1 ? '...' : ''), MARGIN, 768, 12))
  add(textCommand(serverRecord?.id ? `Registro del servidor: ${serverRecord.id}` : 'Vista previa local · Sin registro asociado', MARGIN, 740, 10))
  add(drawPlan(vertices, regions))
  add(textCommand(`Área del plano: ${amount(localArea)} m²`, MARGIN, 279, 16, true))
  add(textCommand(`Equivalencia: ${amount(toSquareVaras(localArea))} varas² · 1 vara = 0.836 m`, MARGIN, 257, 10))
  add(textCommand(serverRecord ? `Área registrada por el servidor: ${amount(serverRecord.totalAreaSquareMeters)} m²` : 'Área registrada por el servidor: Sin guardar', MARGIN, 232, 11))
  add(textCommand('El área local corresponde a la geometría mostrada en esta página.', MARGIN, 210, 9))
  add(textCommand('Resultado orientativo según las medidas y direcciones del croquis.', MARGIN, 195, 9))
  add(textCommand('Consulta los datos y las colindancias en las páginas siguientes.', MARGIN, 166, 10))

  let cursor = 0
  const nextPage = () => {
    pages.push('0.12 0.20 0.22 rg\n')
    add(textCommand('Datos y colindancias del terreno', MARGIN, 796, 14, true))
    cursor = 768
  }
  const paragraph = (value, { bold = false, size = 10, gap = 6 } = {}) => {
    for (const line of wrap(value, CONTENT_WIDTH, size)) {
      if (cursor < 60) nextPage()
      add(textCommand(line, MARGIN, cursor, size, bold))
      cursor -= size + 4
    }
    cursor -= gap
  }
  nextPage()
  paragraph(`Terreno: ${terrain.terrainName || 'Sin nombre'}`, { bold: true })
  paragraph(`Tipo de propiedad: ${terrain.propertyType || 'Sin indicar'}`)
  paragraph(`DPI del cliente: ${terrain.clientDpi || 'Sin seleccionar'}`)
  paragraph(`DPI del usuario responsable: ${terrain.userSystemId || 'Sin identificar'}`)
  paragraph(`Descripción: ${terrain.generalDescription || 'Sin descripción'}`)
  paragraph('Colindancias y medidas originales', { bold: true, size: 12 })
  vertices.forEach((point, index) => {
    const side = boundaries[index] || {}
    const measures = formatSideMeasurements(side.measurements || []) || 'Sin medidas ingresadas'
    paragraph(`L${index + 1} · P${index + 1} a P${(index + 1) % vertices.length + 1} · Longitud del dibujo: ${amount(distance(point, vertices[(index + 1) % vertices.length]))} m`, { bold: true })
    paragraph(`Medidas: ${measures}`)
    paragraph(`Orientación: ${side.orientation || 'Sin indicar'} · Colindancia: ${side.referencePoint || 'Sin referencia'}`)
  })
  if (regions.length) {
    paragraph('Subdivisiones del plano', { bold: true, size: 12 })
    regions.forEach((region, index) => paragraph(`R${index + 1} · ${region.cutName || `Región ${index + 1}`}: ${amount(polygonArea(region.points))} m²`))
  }
  if (Number.isFinite(result?.area) && Math.abs(result.area - localArea) > Math.max(0.01, localArea * 1e-8)) {
    paragraph(`Última estimación del editor: ${amount(result.area)} m². El área de este reporte se obtuvo de los vértices incluidos.`)
  }
  paragraph('Aviso del reporte', { bold: true, size: 12 })
  paragraph(serverRecord?.legalNotice || 'Plano preliminar de referencia. Verifica los datos y medidas antes de su utilización definitiva.')
  return assemblePdf(pages)
}

export function createTerrainPdf(options) {
  return new Blob([createTerrainPdfBytes(options)], { type: 'application/pdf' })
}
