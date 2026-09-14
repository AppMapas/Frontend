// Coordenadas cartesianas en metros: X hacia el este, Y hacia el norte.
const EPSILON = 1e-8
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

export function polygonArea(points) {
  if (points.length < 3) return 0
  // Trasladar al origen evita perder precisión con coordenadas grandes.
  const origin = points[0]
  return Math.abs(points.reduce((area, point, i) => {
    const next = points[(i + 1) % points.length]
    return area + (point.x - origin.x) * (next.y - origin.y)
      - (next.x - origin.x) * (point.y - origin.y)
  }, 0)) / 2
}

function onSegment(a, b, p) {
  return Math.abs(cross(a, b, p)) <= EPSILON
    && p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON
    && p.y >= Math.min(a.y, b.y) - EPSILON && p.y <= Math.max(a.y, b.y) + EPSILON
}

function intersects(a, b, c, d) {
  const abC = cross(a, b, c), abD = cross(a, b, d)
  const cdA = cross(c, d, a), cdB = cross(c, d, b)
  return (abC * abD < 0 && cdA * cdB < 0)
    || onSegment(a, b, c) || onSegment(a, b, d)
    || onSegment(c, d, a) || onSegment(c, d, b)
}

export function validatePolygon(points) {
  if (!Array.isArray(points) || points.length < 3) throw new Error('Dibuja al menos tres vértices.')
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error('Las coordenadas deben ser números finitos.')
  }
  const n = points.length
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n]
    if (distance(a, b) <= EPSILON) throw new Error('El terreno contiene vértices repetidos.')
    const previous = points[(i + n - 1) % n]
    if (Math.abs(cross(previous, a, b)) <= EPSILON
      && (previous.x - a.x) * (b.x - a.x) + (previous.y - a.y) * (b.y - a.y) > EPSILON) {
      throw new Error('El terreno contiene lados superpuestos.')
    }
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue
      if (intersects(a, b, points[j], points[(j + 1) % n])) {
        throw new Error('Los lados del terreno no pueden cruzarse ni tocarse entre sí.')
      }
    }
  }
  const area = polygonArea(points)
  if (!Number.isFinite(area) || area <= EPSILON) throw new Error('El terreno debe tener una superficie válida mayor que cero.')
}

export function bearingDegrees(a, b) {
  return (Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI + 360) % 360
}

export function interiorAngleDegrees(previous, current, next) {
  const denominator = distance(previous, current) * distance(current, next)
  if (!denominator) return null
  const dot = (previous.x - current.x) * (next.x - current.x) + (previous.y - current.y) * (next.y - current.y)
  return Math.acos(Math.max(-1, Math.min(1, dot / denominator))) * 180 / Math.PI
}

export function snapPoint(last, raw) {
  const bearing = bearingDegrees(last, raw)
  let snapped = bearing
  for (const [step, tolerance] of [[90, 8], [45, 6], [15, 4]]) {
    const candidate = Math.round(bearing / step) * step
    const delta = Math.abs(candidate - bearing) % 360
    if (Math.min(delta, 360 - delta) <= tolerance) { snapped = candidate; break }
  }
  const length = distance(last, raw), radians = snapped * Math.PI / 180
  return { x: last.x + Math.sin(radians) * length, y: last.y + Math.cos(radians) * length }
}

export function reconstructPolygon(sketch, lengths) {
  if (!Array.isArray(sketch) || sketch.length < 3) throw new Error('Dibuja al menos tres vértices.')
  if (sketch.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error('Las coordenadas deben ser números finitos.')
  }
  if (lengths.length !== sketch.length || lengths.some((length) => !Number.isFinite(length) || length <= 0)) {
    throw new Error('Todos los lados deben tener una longitud válida.')
  }
  // El croquis es orientativo: conservar el comportamiento del editor original.
  // Las diferencias de cierre se informan y no impiden calcular la vista previa.
  const vertices = [{ x: 0, y: 0 }]
  let endpoint = vertices[0]
  sketch.forEach((point, i) => {
    const next = sketch[(i + 1) % sketch.length]
    const scale = lengths[i] / (distance(point, next) || 1)
    endpoint = { x: endpoint.x + (next.x - point.x) * scale, y: endpoint.y + (next.y - point.y) * scale }
    if (i < sketch.length - 1) vertices.push(endpoint)
  })
  const closureGap = distance(vertices[0], endpoint)
  const area = polygonArea(vertices)
  if (!Number.isFinite(area) || !Number.isFinite(closureGap)) throw new Error('Las medidas exceden el rango permitido.')
  const warnings = []
  for (const points of [sketch, vertices]) {
    try { validatePolygon(points) } catch (error) { warnings.push(error.message) }
  }
  const closingLength = distance(vertices.at(-1), vertices[0])
  return { vertices, area, closureGap, closingLength, closureWarningThreshold: 0.5, warnings: [...new Set(warnings)] }
}

export function createRectangle(widthMeters, heightMeters) {
  if (![widthMeters, heightMeters].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('El ancho y el largo deben ser mayores que cero.')
  }
  const vertices = [{ x: 0, y: 0 }, { x: widthMeters, y: 0 }, { x: widthMeters, y: heightMeters }, { x: 0, y: heightMeters }]
  validatePolygon(vertices)
  return vertices
}

export function verticesFromCourses(courses) {
  if (!Array.isArray(courses) || courses.length < 3) throw new Error('Ingresa al menos tres tramos.')
  const vertices = []
  let endpoint = { x: 0, y: 0 }
  courses.forEach((course) => {
    if (!course || !Number.isFinite(course.lengthMeters) || course.lengthMeters <= 0 || !Number.isFinite(course.bearingDegrees)) {
      throw new Error('Cada tramo necesita una longitud mayor que cero y un azimut válido.')
    }
    vertices.push(endpoint)
    const radians = (course.bearingDegrees % 360) * Math.PI / 180
    endpoint = {
      x: endpoint.x + Math.sin(radians) * course.lengthMeters,
      y: endpoint.y + Math.cos(radians) * course.lengthMeters,
    }
  })
  const closureGap = distance(vertices[0], endpoint)
  if (!Number.isFinite(closureGap)) throw new Error('Las medidas exceden el rango permitido.')
  // Igual que el croquis libre, el último tramo no impone un cierre perfecto.
  return { vertices, closureGap }
}

function clipHalfPlane(polygon, origin, normal) {
  const output = []
  const side = (p) => (p.x - origin.x) * normal.x + (p.y - origin.y) * normal.y
  polygon.forEach((current, i) => {
    const previous = polygon[(i + polygon.length - 1) % polygon.length]
    const dc = side(current), dp = side(previous)
    if ((dc <= EPSILON) !== (dp <= EPSILON)) {
      const t = dp / (dp - dc)
      output.push({ x: previous.x + t * (current.x - previous.x), y: previous.y + t * (current.y - previous.y) })
    }
    if (dc <= EPSILON) output.push({ ...current })
  })
  return output.filter((p, i) => distance(p, output[(i + output.length - 1) % output.length]) > EPSILON)
}

function requireConvex(polygon) {
  validatePolygon(polygon)
  const turns = polygon.map((p, i) => cross(p, polygon[(i + 1) % polygon.length], polygon[(i + 2) % polygon.length]))
  if (turns.some((value) => value > EPSILON) && turns.some((value) => value < -EPSILON)) {
    throw new Error('La división está disponible para terrenos convexos; este terreno tiene entrantes.')
  }
}

function cuttingNormal(start, end) {
  if (!start || !end || [start.x, start.y, end.x, end.y].some((value) => !Number.isFinite(value))) {
    throw new Error('Indica dos puntos válidos para la división.')
  }
  const length = distance(start, end)
  if (length <= EPSILON) throw new Error('Los puntos de entrada y salida deben ser distintos.')
  return { x: -(end.y - start.y) / length, y: (end.x - start.x) / length }
}

export function splitByLine(polygon, start, end) {
  requireConvex(polygon)
  const normal = cuttingNormal(start, end)
  const regions = [
    { cutName: 'Lote A', points: clipHalfPlane(polygon, start, normal) },
    { cutName: 'Lote B', points: clipHalfPlane(polygon, start, { x: -normal.x, y: -normal.y }) },
  ].map((region) => ({ ...region, area: polygonArea(region.points) }))
  if (regions.some((region) => region.area <= EPSILON)) {
    throw new Error('La línea debe atravesar el terreno y dejar un lote a cada lado.')
  }
  validateSubdivision(polygon, regions)
  return regions
}

// La triangulación permite verificar también padres y regiones cóncavos.
// Las áreas de intersección detectan lados que salen del padre aunque sus
// extremos estén dentro, y solapes que una simple suma de áreas no detecta.
function triangulate(polygon) {
  const points = polygon.map((point) => ({ ...point }))
  for (let i = points.length - 1; i >= 0 && points.length > 3; i--) {
    if (Math.abs(cross(points[(i + points.length - 1) % points.length], points[i], points[(i + 1) % points.length])) <= EPSILON) {
      points.splice(i, 1)
    }
  }
  const origin = points[0]
  const signedArea = points.reduce((sum, point, i) => sum + cross(origin, point, points[(i + 1) % points.length]), 0)
  if (signedArea < 0) points.reverse()
  const triangles = []
  while (points.length > 3) {
    let removed = false
    for (let i = 0; i < points.length; i++) {
      const previousIndex = (i + points.length - 1) % points.length, nextIndex = (i + 1) % points.length
      const a = points[previousIndex], b = points[i], c = points[nextIndex]
      if (cross(a, b, c) <= EPSILON) continue
      const containsPoint = points.some((p, j) => j !== previousIndex && j !== i && j !== nextIndex
        && cross(a, b, p) >= -EPSILON && cross(b, c, p) >= -EPSILON && cross(c, a, p) >= -EPSILON)
      if (containsPoint) continue
      triangles.push([a, b, c])
      points.splice(i, 1)
      removed = true
      break
    }
    if (!removed) throw new Error('No se pudo verificar la geometría de las subdivisiones.')
  }
  triangles.push(points)
  return triangles
}

function intersectionArea(firstTriangles, secondTriangles) {
  let area = 0
  for (const first of firstTriangles) {
    for (const second of secondTriangles) {
      let intersection = first
      second.forEach((point, i) => {
        const next = second[(i + 1) % second.length]
        intersection = clipHalfPlane(intersection, point, { x: next.y - point.y, y: point.x - next.x })
      })
      area += polygonArea(intersection)
    }
  }
  return area
}

export function validateSubdivision(polygon, regions) {
  validatePolygon(polygon)
  if (!Array.isArray(regions) || regions.length < 2) throw new Error('La división debe contener al menos dos regiones.')
  const parentArea = polygonArea(polygon)
  // Margen numérico interno para operaciones en coma flotante; no altera el
  // dibujo, las medidas ni el cierre del croquis.
  const areaEpsilon = Math.max(EPSILON, parentArea * 1e-9)
  const parentTriangles = triangulate(polygon)
  const checked = regions.map((region) => {
    validatePolygon(region?.points)
    return { area: polygonArea(region.points), triangles: triangulate(region.points) }
  })
  checked.forEach((region, i) => {
    if (region.area - intersectionArea(region.triangles, parentTriangles) > areaEpsilon) {
      throw new Error('Una subdivisión se encuentra fuera del terreno.')
    }
    for (let j = 0; j < i; j++) {
      if (intersectionArea(region.triangles, checked[j].triangles) > areaEpsilon) {
        throw new Error('Las subdivisiones no pueden superponerse.')
      }
    }
  })
  if (Math.abs(checked.reduce((sum, region) => sum + region.area, 0) - parentArea) > areaEpsilon) {
    throw new Error('Las subdivisiones no conservan el área del terreno.')
  }
  return true
}

export function splitByStreet(polygon, start, end, width) {
  requireConvex(polygon)
  if (!start || !end || [start.x, start.y, end.x, end.y, width].some((v) => !Number.isFinite(v)) || width <= 0) {
    throw new Error('Indica dos puntos válidos y un ancho mayor que cero.')
  }
  const normal = cuttingNormal(start, end)
  const opposite = { x: -normal.x, y: -normal.y }
  const left = { x: start.x + normal.x * width / 2, y: start.y + normal.y * width / 2 }
  const right = { x: start.x - normal.x * width / 2, y: start.y - normal.y * width / 2 }
  const regions = [
    { cutName: 'Lote A', points: clipHalfPlane(polygon, left, opposite) },
    { cutName: 'Calle', points: clipHalfPlane(clipHalfPlane(polygon, left, normal), right, opposite) },
    { cutName: 'Lote B', points: clipHalfPlane(polygon, right, normal) },
  ]
  if (regions.some((region) => polygonArea(region.points) <= EPSILON)) {
    throw new Error('La calle debe atravesar el terreno y dejar un lote a cada lado. Revisa el trazo y el ancho.')
  }
  regions.forEach((region) => { validatePolygon(region.points); region.area = polygonArea(region.points) })
  validateSubdivision(polygon, regions)
  return regions
}

export function fitViewport(points, width, height, padding = 65) {
  if (!points.length) return { scale: 14, offsetX: padding, offsetY: height - padding }
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const scale = Math.max(0.000001, Math.min(Math.max(1, width - padding * 2) / (maxX - minX || 1), Math.max(1, height - padding * 2) / (maxY - minY || 1)))
  return { scale, offsetX: width / 2 - (minX + maxX) * scale / 2, offsetY: height / 2 + (minY + maxY) * scale / 2 }
}

export const toScreen = (p, view) => ({ x: p.x * view.scale + view.offsetX, y: view.offsetY - p.y * view.scale })
export const toWorld = (p, view) => ({ x: (p.x - view.offsetX) / view.scale, y: (view.offsetY - p.y) / view.scale })
export const vertexLabel = (i) => i < 26 ? String.fromCharCode(65 + i) : `P${i + 1}`
