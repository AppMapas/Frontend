import { defineStore } from 'pinia'
import { processCatalogApi } from '../services/processCatalogApi.js'

function replaceById(items, item) {
  const index = items.findIndex((current) => current.id === item.id)
  if (index < 0) {
    return [...items, item]
  }
  return items.map((current) => {
    if (current.id === item.id) return item
    return current
  })
}

function toSummary(processType) {
  return {
    id: processType.id,
    name: processType.name,
    description: processType.description,
    status: processType.status,
    version: processType.version,
  }
}

export const useProcessCatalogStore = defineStore('processCatalog', {
  state: () => ({
    requirements: [],
    processTypes: [],
    loadingRequirements: false,
    loadingProcessTypes: false,
  }),

  actions: {
    async loadRequirements() {
      this.loadingRequirements = true
      try {
        this.requirements = await processCatalogApi.getRequirements()
        return this.requirements
      } finally {
        this.loadingRequirements = false
      }
    },

    async loadProcessTypes() {
      this.loadingProcessTypes = true
      try {
        this.processTypes = await processCatalogApi.getProcessTypes()
        return this.processTypes
      } finally {
        this.loadingProcessTypes = false
      }
    },

    async getProcessType(id) {
      const processType = await processCatalogApi.getProcessType(id)
      this.processTypes = replaceById(this.processTypes, toSummary(processType))
      return processType
    },

    async saveRequirement(id, payload) {
      let saved
      if (id === null) {
        saved = await processCatalogApi.createRequirement(payload)
      } else {
        saved = await processCatalogApi.updateRequirement(id, payload)
      }
      this.requirements = replaceById(this.requirements, saved)
      return saved
    },

    async deactivateRequirement(id) {
      const saved = await processCatalogApi.deactivateRequirement(id)
      this.requirements = replaceById(this.requirements, saved)
      return saved
    },

    async saveProcessType(id, payload) {
      let saved
      if (id === null) {
        saved = await processCatalogApi.createProcessType(payload)
      } else {
        saved = await processCatalogApi.updateProcessType(id, payload)
      }
      this.processTypes = replaceById(this.processTypes, toSummary(saved))
      return saved
    },

    async publishProcessType(id, version) {
      const saved = await processCatalogApi.publishProcessType(id, version)
      this.processTypes = replaceById(this.processTypes, toSummary(saved))
      return saved
    },

    async deactivateProcessType(id, version) {
      const saved = await processCatalogApi.deactivateProcessType(id, version)
      this.processTypes = replaceById(this.processTypes, toSummary(saved))
      return saved
    },
  },
})
