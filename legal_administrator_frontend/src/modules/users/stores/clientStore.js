import { ref } from 'vue'
import { defineStore } from 'pinia'
import { clientsApi } from '../services/clientsApi.js'
import { clientCatalogApi } from '../services/clientCatalogApi.js'
import { usePagedResource } from '../../../shared/lists/usePagedResource.js'

export const useClientStore = defineStore('clients', () => {
  const directory = usePagedResource(clientsApi.search)
  const countries = ref([])
  const maritalStatuses = ref([])
  const municipalities = ref([])
  const catalogsLoading = ref(false)
  const catalogsReady = ref(false)
  let catalogsRequest = null
  let generation = 0

  async function loadCatalogs() {
    if (catalogsReady.value) return
    if (catalogsRequest) return catalogsRequest
    const current = generation
    catalogsLoading.value = true
    catalogsRequest = Promise.all([
      clientCatalogApi.countries(), clientCatalogApi.maritalStatuses(), clientCatalogApi.municipalities(),
    ]).then(([countryList, statusList, municipalityList]) => {
      if (current !== generation) return
      countries.value = countryList
      maritalStatuses.value = statusList
      municipalities.value = municipalityList
      catalogsReady.value = true
    }).finally(() => {
      if (current !== generation) return
      catalogsLoading.value = false
      catalogsRequest = null
    })
    return catalogsRequest
  }
  function resetSession() {
    generation += 1
    directory.reset()
    countries.value = []
    maritalStatuses.value = []
    municipalities.value = []
    catalogsReady.value = false
    catalogsLoading.value = false
    catalogsRequest = null
  }
  return { ...directory, countries, maritalStatuses, municipalities, catalogsLoading, catalogsReady,
    loadCatalogs, resetSession, get: clientsApi.get, create: clientsApi.create,
    update: clientsApi.update, deactivate: clientsApi.deactivate }
})
