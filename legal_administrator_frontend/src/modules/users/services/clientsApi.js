import { httpClient } from '@/shared/api/httpClient'

export const clientsApi = {
  async getAll() {
    const clients = await httpClient('/clients')
    if (!Array.isArray(clients)) throw new Error('El servidor no devolvió una lista de clientes válida.')
    return clients
  },
}
