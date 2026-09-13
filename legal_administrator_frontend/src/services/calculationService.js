import { httpClient } from '@/shared/api/httpClient'

/**
 * Servicio para el módulo de cálculos de áreas y conversiones métricas
 */
export const calculationService = {
  /**
   * Envía las medidas de un terreno para calcular área total y subtramos
   */
  async calculateArea(data) {
    return httpClient('/calculations/area', {
      method: 'POST',
      body: data,
    })
  },

  /**
   * Convierte entre diferentes unidades de medida (metros, varas, cuerdas, pies)
   */
  async convertUnits(value, fromUnit, toUnit) {
    return httpClient(`/calculations/convert?value=${value}&from=${fromUnit}&to=${toUnit}`)
  },

  /**
   * Obtiene el listado de expedientes registrados
   */
  async getRecords() {
    return httpClient('/calculations/history')
  }
}
