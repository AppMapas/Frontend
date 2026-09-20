/**
 * Constantes oficiales del sistema LegalAdministrator
 */

// Factor utilizado por UnitConversion.java en el backend.
const VARA_TO_M = 0.836
export const CONVERSION_FACTORS = {
  VARA_TO_M,
  M_TO_VARA: 1 / VARA_TO_M,
  VARA2_TO_M2: VARA_TO_M ** 2,
  M2_TO_VARA2: 1 / (VARA_TO_M ** 2),
  CUERDA_SIDE_VARAS: 26,
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
