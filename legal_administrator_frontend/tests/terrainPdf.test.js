import test from 'node:test'
import assert from 'node:assert/strict'
import { createTerrainPdf, createTerrainPdfBytes } from '../src/modules/terrenos/domain/terrainPdf.js'

const vertices = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }, { x: 0, y: 30 }]
const terrain = { terrainName: 'Los Pinos', clientDpi: '0012345678901', userSystemId: '0098765432101', propertyType: 'RURAL', generalDescription: 'Finca de prueba' }
const boundaries = [20, 30, 20, 30].map((value, index) => ({ orientation: 'N', referencePoint: `Vecino ${index + 1}`, measurements: [{ value, unit: 'metros' }] }))
const options = { terrain, vertices, boundaries, result: { area: 600 } }
const decode = (data) => Buffer.from(data).toString('latin1')
const contentStreams = (pdf) => [...pdf.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g)]

test('reporte local crea un PDF binario con catálogo, fuentes WinAnsi y páginas A4', async () => {
  const blob = createTerrainPdf(options)
  assert.ok(blob instanceof Blob)
  assert.equal(blob.type, 'application/pdf')
  const pdf = decode(await blob.arrayBuffer())
  assert.ok(pdf.startsWith('%PDF-1.4\n'))
  assert.ok(pdf.endsWith('%%EOF\n'))
  assert.match(pdf, /\/Type \/Catalog/)
  assert.match(pdf, /\/MediaBox \[0 0 595\.28 841\.89\]/)
  assert.match(pdf, /\/BaseFont \/Helvetica \/Encoding \/WinAnsiEncoding/)
  assert.match(pdf, /\/Count 2/)
  assert.match(pdf, /Página 1 de 2/)
  assert.match(pdf, /Página 2 de 2/)
})

test('xref apunta a cada objeto y longitudes de stream coinciden byte por byte', () => {
  const pdfBytes = createTerrainPdfBytes(options)
  assert.ok(pdfBytes instanceof Uint8Array)
  const pdf = decode(pdfBytes)
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1])
  assert.equal(pdf.slice(xref, xref + 4), 'xref')
  const entries = pdf.slice(xref).match(/\d{10} \d{5} [fn] /g)
  assert.equal(entries[0], '0000000000 65535 f ')
  entries.slice(1).forEach((entry, index) => {
    const offset = Number(entry.slice(0, 10))
    assert.ok(pdf.slice(offset).startsWith(`${index + 1} 0 obj\n`))
  })
  const streams = contentStreams(pdf)
  assert.equal(streams.length, 2)
  streams.forEach(([, length, content]) => assert.equal(Buffer.byteLength(content, 'latin1'), Number(length)))
})

test('polígono vectorial conserva proporciones reales, norte y longitudes métricas', () => {
  const pdf = decode(createTerrainPdfBytes(options))
  const firstPage = contentStreams(pdf)[0][2]
  const polygon = firstPage.match(/([\d.]+) ([\d.]+) m\n([\d.]+) ([\d.]+) l\n([\d.]+) ([\d.]+) l\n([\d.]+) ([\d.]+) l\nh\nB/)
  assert.ok(polygon)
  const coordinates = polygon.slice(1).map(Number)
  const width = coordinates[2] - coordinates[0]
  const height = coordinates[5] - coordinates[3]
  assert.ok(Math.abs(width / height - 20 / 30) < 0.00001)
  assert.ok(height > 0, 'El norte conserva Y creciente')
  assert.match(firstPage, /\(N\) Tj/)
  assert.match(firstPage, /\(L1: 20\.00 m\)/)
  assert.match(firstPage, /\(L2: 30\.00 m\)/)
})

test('área del PDF proviene de sus vértices y se distingue del resultado registrado', () => {
  const pdf = decode(createTerrainPdfBytes({
    ...options,
    result: { area: 999 },
    serverRecord: { id: 18, totalAreaSquareMeters: 1250, legalNotice: 'Aviso legal del servidor' },
  }))
  assert.match(pdf, /Área del plano: 600\.00 m²/)
  assert.match(pdf, /Área registrada por el servidor: 1250\.00 m²/)
  assert.match(pdf, /Registro del servidor: 18/)
  assert.match(pdf, /Última estimación del editor: 999\.00 m²/)
  assert.match(pdf, /Aviso legal del servidor/)
  assert.match(pdf, /1 vara = 0\.836 m/)
  assert.doesNotMatch(pdf, /0\.835906/)
})

test('detalle conserva DPI, medidas compuestas originales y colindancias', () => {
  const pdf = decode(createTerrainPdfBytes({
    ...options,
    boundaries: [{ orientation: 'O', referencePoint: 'Calle de la estación', measurements: [{ value: 25, unit: 'varas' }, { value: 12, unit: 'pulgadas' }] }, ...boundaries.slice(1)],
  }))
  assert.match(pdf, /DPI del cliente: 0012345678901/)
  assert.match(pdf, /DPI del usuario responsable: 0098765432101/)
  assert.match(pdf, /Medidas: 25 varas \+ 12 pulg/)
  assert.match(pdf, /Orientación: O/)
  assert.match(pdf, /Calle de la estación/)
  assert.match(pdf, /Área registrada por el servidor: Sin guardar/)
})

test('subdivisiones se dibujan y sus áreas se calculan con sus puntos', () => {
  const regions = [
    { cutName: 'Lote A', area: 999, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 30 }, { x: 0, y: 30 }] },
    { cutName: 'Lote B', points: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }, { x: 10, y: 30 }] },
  ]
  const pdf = decode(createTerrainPdfBytes({ ...options, regions }))
  assert.match(pdf, /\[4 2\] 0 d/)
  assert.match(pdf, /\(R1\) Tj/)
  assert.match(pdf, /\(R2\) Tj/)
  assert.match(pdf, /R1 · Lote A: 300\.00 m²/)
  assert.match(pdf, /R2 · Lote B: 300\.00 m²/)
})

test('muchas colindancias y textos extensos agregan páginas sin desbordar el pie', () => {
  const manyVertices = Array.from({ length: 80 }, (_, index) => ({ x: 50 * Math.cos(index * Math.PI / 40), y: 50 * Math.sin(index * Math.PI / 40) }))
  const manyBoundaries = manyVertices.map((_point, index) => ({ referencePoint: `Vecino número ${index + 1}, ${'descripción '.repeat(15)}`, measurements: [{ value: 5, unit: 'varas' }] }))
  const pdf = decode(createTerrainPdfBytes({ ...options, vertices: manyVertices, boundaries: manyBoundaries, terrain: { ...terrain, generalDescription: 'W'.repeat(1500) } }))
  const pages = Number(pdf.match(/\/Count (\d+)/)[1])
  assert.ok(pages > 10)
  assert.equal(contentStreams(pdf).length, pages)
  assert.match(pdf, /L80/)
  assert.match(pdf, new RegExp(`Página ${pages} de ${pages}`))
  contentStreams(pdf).slice(1).forEach(([, , content]) => {
    const textPositions = [...content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)]
    textPositions.forEach((position) => {
      const y = Number(position[2])
      assert.ok(y === 27 || y >= 60 && y <= 796, `Texto fuera del contenido: ${y}`)
    })
  })
})

test('escapa operadores PDF en campos de texto y conserva español en WinAnsi', () => {
  const pdf = decode(createTerrainPdfBytes({
    ...options,
    terrain: { ...terrain, terrainName: 'Peña (áéíóú) \\ cierre) Tj\nET' },
    serverRecord: { id: 2, totalAreaSquareMeters: 600, legalNotice: '“Descripción” de Peña: € y emoji 🏠' },
  }))
  assert.match(pdf, /Peña \\\(áéíóú\\\) \\\\ cierre\\\) Tj ET/)
  assert.ok(pdf.includes('\x93Descripción\x94'))
  assert.ok(pdf.includes('\x80'))
  assert.doesNotMatch(pdf, /🏠/)
  assert.equal(contentStreams(pdf).length, 2)
})

test('la generación no muta el borrador y rechaza coordenadas inválidas', () => {
  const original = JSON.stringify(options)
  createTerrainPdfBytes(options)
  assert.equal(JSON.stringify(options), original)
  for (const invalid of [[], null, vertices.slice(0, 2), [{ x: Infinity, y: 0 }, ...vertices.slice(1)]]) {
    assert.throws(() => createTerrainPdfBytes({ ...options, vertices: invalid }), /tres vértices válidos/)
  }
})
