/**
 * Constantes oficiales del sistema LegalAdministrator
 */

// Factor oficial de conversión legal en Guatemala: 1 vara = 0.835906 metros lineales
export const CONVERSION_FACTORS = {
  VARA_TO_M: 0.835906,
  M_TO_VARA: 1 / 0.835906,
  // 1 vara² = 0.835906 * 0.835906 m² = 0.69873884 m²
  VARA2_TO_M2: 0.69873884,
  M2_TO_VARA2: 1 / 0.69873884,
  CUERDA_STANDARD_VARAS: 441 // 21 x 21 varas
}

export const APP_INFO = {
  name: 'LegalAdministrator',
  shortName: 'LegalAdmin',
  version: '1.0.0',
  description: 'Gestor Jurídico y Cálculo de Áreas para Trámites Notariales'
}

export const NAV_SECTIONS = [
  { path: '/terrenos', label: 'Terrenos' },
  { path: '/historial', label: 'Historial' },
  { path: '/reportes', label: 'Reportes' },
  { path: '/clientes', label: 'Clientes' }
]
