import { defineStore } from 'pinia'
import { createTerrainDefinition } from '../domain/terrainEditor.js'
import { calculationService } from '../services/calculationApi.js'

export const useTerrainStore = defineStore('terrain', createTerrainDefinition(calculationService))
