import { apiClient } from './api'

/**
 * Servicio para el módulo de cálculos de áreas y conversiones métricas
 */
export const calculationService = {
  /**
   * Envía las medidas de un terreno para calcular área total y subtramos
   */
  async calculateArea(data) {
    return apiClient('/calculations/area', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  /**
   * Convierte entre diferentes unidades de medida (metros, varas, cuerdas, pies)
   */
  async convertUnits(value, fromUnit, toUnit) {
    return apiClient(`/calculations/convert?value=${value}&from=${fromUnit}&to=${toUnit}`)
  },

  /**
   * Obtiene el listado de expedientes registrados
   */
  async getRecords() {
    return apiClient('/calculations/history')
  }
}
